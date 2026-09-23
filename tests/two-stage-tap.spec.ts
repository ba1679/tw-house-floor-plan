import { test, expect } from "@playwright/test";
import { blankSpot } from "./viewer-page";
import { createViewerState, reduceViewer } from "@/lib/viewer/interaction";
import type { Hotspot } from "@/lib/floorplan/types";

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

test("重疊熱區的面積小者優先：保留舊圖柱窗交疊的獨立回歸案例", () => {
  const column: Hotspot = { id: "column", symbol_id: "column", shape: "rect", coords: [0, 0, 40, 40] };
  const window_: Hotspot = { id: "window", symbol_id: "window", shape: "rect", coords: [37, -12, 200, 24] };
  for (const hotspots of [[window_, column], [column, window_]]) {
    const initial = createViewerState({ hotspots, viewBox: { x: -100, y: -200, width: 1197, height: 1100 }, viewportWidth: 343, viewportHeight: 600 });
    const candidates = reduceViewer(initial, { type: "TAP", x: 38, y: 6 });
    expect(candidates.candidates).toHaveLength(2);
    const selected = reduceViewer(candidates, { type: "TAP", x: 38, y: 6 });
    expect(selected.selected?.id).toBe("column");
  }
});

test("相鄰的柱與窗都成為候選，第二段仍能準確選柱", async ({ page }) => {
  await page.goto(PLAN);

  const column = page.locator("#hs-col-ne");
  const window_ = page.locator("#hs-win-bed3");

  // 新圖已避開柱窗實體交疊，改驗證相鄰候選的觸控辨識。
  const col = (await column.boundingBox())!;
  await page.mouse.click(col.x + col.width / 2, col.y + col.height / 2);
  await expect(column).toHaveAttribute("data-state", "candidate");
  await expect(window_).toHaveAttribute("data-state", "candidate");

  // 第二段：點在柱本身；不能誤選旁邊同屬候選的窗。
  const zoomedCol = (await column.boundingBox())!;
  await page.mouse.click(zoomedCol.x + zoomedCol.width / 2, zoomedCol.y + zoomedCol.height / 2);

  await expect(page.getByRole("status")).toContainText("柱");
  await expect(column).toHaveAttribute("data-state", "selected");
  await expect(window_).not.toHaveAttribute("data-state", "selected");
});

test("點在房子外面的留白處：給提示，而且不放大", async ({ page }) => {
  await page.goto(PLAN);

  const plan = page.getByRole("group", { name: /三房兩廳/ });
  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;

  // 使用新版圖面經量測的留白，不再假定上緣正中央沒有雨遮／平開窗。
  const frame = (await plan.boundingBox())!;
  await page.mouse.click(blankSpot(frame).x, blankSpot(frame).y);

  await expect(page.getByRole("status")).toContainText("換個地方");

  // 放大了也沒東西可選，只會讓使用者迷失在一個空畫面裡——所以縮放維持不動。
  const after = (await door.boundingBox())!;
  expect(after.width).toBeCloseTo(before.width, 1);
  expect(after.x).toBeCloseTo(before.x, 1);
  await expect(door).toHaveAttribute("data-state", "normal");
});

test("密集情況：客浴周邊一次圈出 8 個候選，8 個都選得到", async ({ page }) => {
  await page.goto(PLAN);

  const plan = page.getByRole("group", { name: /三房兩廳/ });
  // 全圖時畫布與可視區域重疊，所以這個框就是可視區域的框。放大之後它不再是——
  // 但框本身不會動，之後裁切用的是這一份。
  const frame = (await plan.boundingBox())!;
  const bathroom = (await page.locator("#room-bath-g").boundingBox())!;
  const worstTap = {
    x: bathroom.x + bathroom.width * 0.2,
    y: bathroom.y + bathroom.height * 0.5,
  };

  await page.mouse.click(worstTap.x, worstTap.y);

  // 新版格局實測的密集場景，不能沿用舊主浴的 9 個候選；仍逐一確認可見、可選。
  const candidates = page.locator('[data-state="candidate"]');
  await expect(candidates).toHaveCount(8);
  const ids = await candidates.evaluateAll((els) => els.map((el) => el.id));

  for (const id of ids) {
    // 每一輪的開頭都停在第一段：候選是同一組 8 個。
    await expect(candidates).toHaveCount(8);

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
    await expect(target, `${id} 在 8 個候選裡選不到`).toHaveAttribute("data-state", "selected");

    // 說明卡是版面裡的一格，升起來會把圖收進上方那條可視帶（票 03 決議 3）——
    // 圖上同一個位置因此換了螢幕座標。關掉卡片讓視野還原，再重新量一次那個位置，
    // 回到第一段做下一個。（照抄迴圈外量到的 worstTap 會點到別的地方去。）
    await page.locator("#info-sheet").getByRole("button", { name: "關閉說明" }).click();
    await expect(page.locator("#info-sheet")).toBeHidden();
    // 等圖真的長回全圖再量：卡片收起到圖回到原尺寸中間隔著一次版面回流，
    // 量在回流當中就會拿到一個下一刻已經不成立的座標。
    await expect
      .poll(async () => Math.round((await plan.boundingBox())!.height))
      .toBe(Math.round(frame.height));
    const room = (await page.locator("#room-bath-g").boundingBox())!;
    await page.mouse.click(room.x + room.width * 0.2, room.y + room.height * 0.5);
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
