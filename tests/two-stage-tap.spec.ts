import { test, expect } from "@playwright/test";

// 兩段式點擊是全站的基礎操作（PRD §6.1.1）：這張圖 37 個熱區沒有一個滿足 44×44px，
// 所以不要求使用者點準——先點大略位置放大，再點一次確認。
//
// 座標一律從瀏覽器自己算出來的熱區位置量起，測試不自己算一次 cm → px。
// 換算層是這個檢視器最會壞的地方（spec §Testing Decisions），測試若抄同一條公式，
// 公式錯了兩邊會一起錯、一起過。

const PLAN = "/layouts/3b2l_standard";

test("點在大門右邊 13px——沒點準——仍然選得到大門", async ({ page }) => {
  await page.goto(PLAN);

  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;

  // 故意點歪：大門右緣再往外 13px，在第一段的 46px 容錯之內。
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);

  // 第一段：圖放大到 3×，大門成為候選之一。
  const zoomed = (await door.boundingBox())!;
  expect(zoomed.width).toBeGreaterThan(before.width * 2.5);
  await expect(door).toHaveAttribute("data-state", "candidate");

  // 第二段：點在大門上確認。
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);

  await expect(page.getByRole("status")).toContainText("雙開門");
});

test("柱與窗重疊的地方，選到的是柱——面積小者優先", async ({ page }) => {
  await page.goto(PLAN);

  const column = page.locator("#hs-col-nw");
  const window_ = page.locator("#hs-win-living");

  // 第一段：點客廳西北角，柱與壓在它上面的窗都進候選。
  const col = (await column.boundingBox())!;
  await page.mouse.click(col.x + col.width / 2, col.y + col.height / 2);
  await expect(column).toHaveAttribute("data-state", "candidate");
  await expect(window_).toHaveAttribute("data-state", "candidate");

  // 第二段：點在兩者重疊的那一小塊上。柱若輸，它到處都被窗蓋住，等於永遠點不到。
  const zoomedCol = (await column.boundingBox())!;
  const zoomedWin = (await window_.boundingBox())!;
  const overlap = {
    left: Math.max(zoomedCol.x, zoomedWin.x),
    right: Math.min(zoomedCol.x + zoomedCol.width, zoomedWin.x + zoomedWin.width),
    top: Math.max(zoomedCol.y, zoomedWin.y),
    bottom: Math.min(zoomedCol.y + zoomedCol.height, zoomedWin.y + zoomedWin.height),
  };
  expect(overlap.right, "柱與窗沒有重疊，這條測試等於沒測").toBeGreaterThan(overlap.left);
  // 重疊區放大 3× 之後仍然遠小於 44px 的觸控規格——這正是兩段式存在的理由。
  expect(overlap.right - overlap.left).toBeLessThan(44);

  await page.mouse.click((overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2);

  await expect(page.getByRole("status")).toContainText("柱");
  await expect(column).toHaveAttribute("data-state", "selected");
  await expect(window_).not.toHaveAttribute("data-state", "selected");
});

test("點在房子外面的留白處：給提示，而且不放大", async ({ page }) => {
  await page.goto(PLAN);

  const plan = page.getByRole("img", { name: /三房兩廳/ });
  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;

  // 圖的最上緣、房子外面的那條留白：46px 容錯之內沒有任何熱區（最近的還有 212cm）。
  // spec 原本指定「玄關左邊的空白」，那是原型在 375px 全出血下量的；現在圖被頁面的
  // 左右留白擠成 343px，容錯換算成圖面是 161cm 而不是 147cm，房子裡已經沒有一個
  // 點是空的（最寬的客廳也只剩 159cm 淨空）。留白處在任何合理寬度下都空，因此改點這裡。
  const frame = (await plan.boundingBox())!;
  await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height * 0.03);

  await expect(page.getByRole("status")).toContainText("換個地方");

  // 放大了也沒東西可選，只會讓使用者迷失在一個空畫面裡——所以縮放維持不動。
  const after = (await door.boundingBox())!;
  expect(after.width).toBeCloseTo(before.width, 1);
  expect(after.x).toBeCloseTo(before.x, 1);
  await expect(door).toHaveAttribute("data-state", "normal");
});

test("最壞情況：主臥衛浴一次圈出 9 個候選，9 個都選得到", async ({ page }) => {
  await page.goto(PLAN);

  const plan = page.getByRole("img", { name: /三房兩廳/ });
  // 全圖時畫布與可視區域重疊，所以這個框就是可視區域的框。放大之後它不再是——
  // 但框本身不會動，之後裁切用的是這一份。
  const frame = (await plan.boundingBox())!;
  const bathroom = (await page.locator("#room-bath-m").boundingBox())!;
  const worstTap = {
    x: bathroom.x + bathroom.width * 0.5,
    y: bathroom.y + bathroom.height * 0.75,
  };

  await page.mouse.click(worstTap.x, worstTap.y);

  // 9 是原型在這張圖上實測出來的最壞情況（門＋三窗＋兩雨遮＋馬桶＋洗臉盆＋浴缸）。
  // 這個數字會隨可視區域的寬度變動——它變了就代表最壞情況搬家了，值得知道。
  const candidates = page.locator('[data-state="candidate"]');
  await expect(candidates).toHaveCount(9);
  const ids = await candidates.evaluateAll((els) => els.map((el) => el.id));

  for (const id of ids) {
    // 每一輪的開頭都停在第一段：候選是同一組 9 個（迴圈尾端會再點一次回到這裡）。
    await expect(candidates).toHaveCount(9);

    const target = page.locator(`#${id}`);
    const box = (await target.boundingBox())!;

    // 放大後有些候選被可視區域切掉一半，幾何中心會落在框外。點還在畫面上的那一塊。
    const visible = {
      left: Math.max(box.x, frame.x),
      right: Math.min(box.x + box.width, frame.x + frame.width),
      top: Math.max(box.y, frame.y),
      bottom: Math.min(box.y + box.height, frame.y + frame.height),
    };
    expect(visible.right, `${id} 放大後完全不在畫面上，點不到`).toBeGreaterThan(visible.left);
    expect(visible.bottom, `${id} 放大後完全不在畫面上，點不到`).toBeGreaterThan(visible.top);

    await page.mouse.click((visible.left + visible.right) / 2, (visible.top + visible.bottom) / 2);
    await expect(target, `${id} 在 9 個候選裡選不到`).toHaveAttribute("data-state", "selected");

    // 確認之後視野已經還原，同一個點會圈出同一組候選——回到第一段做下一個。
    await page.mouse.click(worstTap.x, worstTap.y);
  }
});

test("看完一個符號後直接點圖上別處，就開始下一個——不必先按重選", async ({ page }) => {
  await page.goto(PLAN);

  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);
  const zoomed = (await door.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(door).toHaveAttribute("data-state", "selected");

  // 「重選」是明確的退出鍵，不是看下一個符號的必經步驟（PRD §11 #20）。
  const bedroom = (await page.locator("#room-master").boundingBox())!;
  await page.mouse.click(bedroom.x + bedroom.width / 2, bedroom.y + bedroom.height / 2);

  await expect(door).toHaveAttribute("data-state", "normal");
  await expect(page.locator('[data-state="candidate"]').first()).toBeVisible();
  await expect(page.getByRole("status")).toContainText("再點一次確認");
});

test("第二段只認第一段圈出的候選：放大後才進畫面的熱區選不到", async ({ page }) => {
  await page.goto(PLAN);

  const corner = page.locator("#hs-col-nw");
  const intruder = page.locator("#hs-col-living-ne");

  // 第一段點客廳西北角。客廳東北角那根柱離得夠遠，沒有進候選。
  const col = (await corner.boundingBox())!;
  await page.mouse.click(col.x + col.width / 2, col.y + col.height / 2);
  await expect(intruder).toHaveAttribute("data-state", "normal");

  // 放大之後它進了畫面。第二段若也掃它，第一段圈出來的那幾個高亮就是騙人的（PRD §11 #19）。
  const box = (await intruder.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(intruder).not.toHaveAttribute("data-state", "selected");
});

test("按「重選」退回第一段：候選清掉、視野還原", async ({ page }) => {
  await page.goto(PLAN);

  const door = page.locator("#hs-door-entry");
  const reselect = page.getByRole("button", { name: "重選" });

  // 還在第一段時沒有東西可以退回，按鍵不該佔著版面。
  await expect(reselect).toBeHidden();

  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);
  await expect(door).toHaveAttribute("data-state", "candidate");

  const button = (await reselect.boundingBox())!;
  expect(button.height, "手機上的控制元件要點得到").toBeGreaterThanOrEqual(44);
  await reselect.click();

  // 選錯了不必重新整理頁面：候選清掉，視野回到按下第一段之前的樣子。
  await expect(door).toHaveAttribute("data-state", "normal");
  const after = (await door.boundingBox())!;
  expect(after.width).toBeCloseTo(before.width, 1);
  expect(after.x).toBeCloseTo(before.x, 1);
  await expect(reselect).toBeHidden();
});

test("容錯圈畫的是命中判定當下的半徑，不是放大後重算的", async ({ page }) => {
  await page.goto(PLAN);

  const ring = page.locator("#tap-tolerance");
  await expect(ring).toBeHidden();

  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);

  // 圈是在全圖比例尺下判定的 46px，畫在圖面上就是 46 ÷ 0.2865 ≈ 160cm；
  // 隨畫布放大 3× 之後在畫面上是 138px。若改成放大後才拿 46px 換算，
  // 只會得到 53cm 的圈——畫面上剩三分之一，圈外的熱區卻亮著，看起來像 bug。
  const box = (await ring.boundingBox())!;
  const radius = box.width / 2;
  expect(radius).toBeGreaterThan(46 * 2.5);
  expect(radius).toBeLessThan(46 * 3.5);
});

test("第二段點在候選旁邊 20px 也算數，50px 就不算", async ({ page }) => {
  await page.goto(PLAN);

  const door = page.locator("#hs-door-entry");
  const start = (await door.boundingBox())!;
  await page.mouse.click(start.x + start.width + 13, start.y + start.height / 2);

  // 第二段容錯 30 CSS px：離候選 50px 是「還是沒點到」，留在第二段等使用者再試。
  const zoomed = (await door.boundingBox())!;
  const edge = { x: zoomed.x + zoomed.width, y: zoomed.y + zoomed.height / 2 };
  await page.mouse.click(edge.x + 50, edge.y);
  await expect(door).toHaveAttribute("data-state", "candidate");
  // 沒選中也要看得出來，否則畫面上的字跟成功時一樣，使用者不知道有沒有被聽見。
  await expect(page.getByRole("status")).toContainText("還是沒點到");

  // 20px 在容錯之內，取最近的候選。
  await page.mouse.click(edge.x + 20, edge.y);
  await expect(door).toHaveAttribute("data-state", "selected");
});
