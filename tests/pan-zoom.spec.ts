import { test, expect, type Page } from "@playwright/test";
import { blankSpot, dragLeft, pinch, selectByTwoTaps } from "./viewer-page";

type BoundingBox = { x: number; y: number; width: number; height: number };

// pan/zoom 是「看得清楚」，兩段式點擊是「點得到」——兩件事都要有（PRD §6.1.1、票 04）。
// 這一組測的是使用者自己發起的手勢，以及它與兩段式之間那條界線：
// 拖曳不是點擊、雙擊不是兩次點擊、放大之後 46 CSS px 仍然是 46 CSS px。
//
// 手勢怎麼做出來（雙指、拖曳、哪裡是留白）收在 `viewer-page.ts`：票 08 的高亮也要在同樣的手勢下測一次。

const PLAN = "/layouts/3b2l_standard";

const planOf = (page: Page) => page.getByRole("group", { name: /三房兩廳/ });
const viewportOf = (page: Page) => page.locator("#floorplan-viewport");

test("拖曳平移：圖跟著手指走，而且不會被當成一次點擊", async ({ page }) => {
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;

  // 全圖時整張圖都看得到，沒有東西可以平移（clampView 會把中心夾回來），所以先放大一級。
  await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);
  const zoomed = (await plan.boundingBox())!;

  // 從畫面正中央按下去往左拖。那底下就是熱區——若拖曳被判定成一次 tap，候選會亮起來。
  const frame = (await viewportOf(page).boundingBox())!;
  await dragLeft(page, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, 80);

  // 圖與手指 1:1：拖 80px，圖就往左走 80px（含跨過門檻前的那一小段，不吞掉）。
  const panned = (await plan.boundingBox())!;
  expect(panned.x).toBeCloseTo(zoomed.x - 80, 0);
  expect(panned.width).toBeCloseTo(zoomed.width, 0);
  await expect(page.locator('[data-state="candidate"]')).toHaveCount(0);
  await expect(page.getByRole("status")).not.toContainText("候選");
});

test("雙擊放大一級：手指底下那一點留在原地", async ({ page }) => {
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const anchor = blankSpot(fit);

  await page.mouse.dblclick(anchor.x, anchor.y);

  const after = (await plan.boundingBox())!;
  expect(after.width).toBeCloseTo(fit.width * 2, 0);
  // 錨點不動，圖就以錨點為中心撐開：圖框的左緣與上緣各自離錨點遠一倍。
  expect(after.x).toBeCloseTo(anchor.x - (anchor.x - fit.x) * 2, 0);
  expect(after.y).toBeCloseTo(anchor.y - (anchor.y - fit.y) * 2, 0);

  // 第一下留下的「這附近沒有可以點的東西」在第二下之後就過期了——
  // 使用者的意思已經被理解成「放大這一區」，那句提示留著只會互相矛盾。
  await expect(page.getByRole("status")).toHaveText("");
});

test("落空的那一下順便教會雙擊", async ({ page }) => {
  await page.goto(PLAN);
  const fit = (await planOf(page).boundingBox())!;

  // 雙擊只在「上一下什麼都沒選到」時成立，而那一刻畫面上唯一的字就是這句提示。
  // 沒有這句話，這個手勢在手機上等於不存在——沒有人會去猜它。
  await page.mouse.click(blankSpot(fit).x, blankSpot(fit).y);
  await expect(page.getByRole("status")).toContainText("連點兩下");
});

test("雙指撐開放大、捏合縮小", async ({ page }) => {
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const center = { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };

  await pinch(page, center, 100, 250);
  const out = (await plan.boundingBox())!;
  expect(out.width).toBeCloseTo(fit.width * 2.5, 0);

  await pinch(page, center, 250, 100);
  const back = (await plan.boundingBox())!;
  expect(back.width).toBeCloseTo(fit.width, 0);
});

test("縮放有上下限：縮不到比全圖更小，放大到 8 倍就停住", async ({ page }) => {
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const center = { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };

  // 全圖已經是最小：再捏也不會把圖縮成畫面中央一個點。
  await pinch(page, center, 300, 20);
  expect((await plan.boundingBox())!.width).toBeCloseTo(fit.width, 0);

  // 撐開 11 倍的意圖，停在 8 倍：再放大下去畫面上只剩一條線，看不出那是什麼符號。
  await pinch(page, center, 30, 330);
  expect((await plan.boundingBox())!.width).toBeCloseTo(fit.width * 8, 0);
});

test("一鍵回到全圖：放大之後才出現，按下去回到全圖", async ({ page }) => {
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const reset = page.getByRole("button", { name: "回到全圖" });

  // 已經是全圖時沒有東西可以回去，這顆按鈕不該從平面圖那條可視帶挖走 56px。
  await expect(reset).toBeHidden();

  await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);
  await expect(reset).toBeVisible();
  const button = (await reset.boundingBox())!;
  expect(button.height, "手機上的控制元件要點得到").toBeGreaterThanOrEqual(44);

  await reset.click();
  const after = (await plan.boundingBox())!;
  expect(after.width).toBeCloseTo(fit.width, 0);
  expect(after.x).toBeCloseTo(fit.x, 0);
  expect(after.y).toBeCloseTo(fit.y, 0);
  await expect(reset).toBeHidden();
});

test("放大 4 倍之後，兩段式仍然選得到大門——46 CSS px 在任何倍率下都是 46 CSS px", async ({
  page,
}) => {
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const door = page.locator("#hs-door-entry");
  const start = (await door.boundingBox())!;

  await pinch(page, { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 }, 80, 320);

  // 大門在圖的右緣，放大之後被推出畫面外。往左拖，把它帶回畫面裡——
  // 「放大了看不到我要的東西」在真機上就是這兩個手勢接在一起。
  // 要拖的距離比一個畫面還寬，所以分兩段（手指也離不開畫面）；
  // 拖到圖的右緣就會被夾住，落點因此可能比目標再右邊一點，不影響下面的判斷。
  const frame = (await viewportOf(page).boundingBox())!;
  const from = { x: frame.x + frame.width * 0.8, y: frame.y + frame.height / 2 };
  const offscreen = (await door.boundingBox())!;
  const need = offscreen.x + offscreen.width - (frame.x + frame.width * 0.7);
  await dragLeft(page, from, need / 2);
  await dragLeft(page, from, need / 2);

  const big = (await door.boundingBox())!;
  expect(big.width).toBeCloseTo(start.width * 4, 0);
  expect(big.x, "大門應該被拖回畫面裡了").toBeGreaterThan(frame.x);
  expect(big.x + big.width).toBeLessThan(frame.x + frame.width);

  // 一樣點歪 13px。容錯是 46 CSS px，換算成圖面公分在 4 倍下只剩四分之一——
  // 沒跟著換算的話，這一下會圈進一整片鄰居，或什麼都圈不到。
  await page.mouse.click(big.x + big.width + 13, big.y + big.height / 2);
  await expect(door).toHaveAttribute("data-state", "candidate");

  // 使用者自己已經放到 4 倍，第一段不該把他縮回 3 倍——自動放大是為了看得清楚，
  // 已經夠清楚了就不要動他的視野。
  const zoomed = (await door.boundingBox())!;
  expect(zoomed.width).toBeGreaterThanOrEqual(big.width - 1);

  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(page.getByRole("status")).toContainText("雙開門");
});

// `?fitLocked=1` 是 M2 替還不存在的找找看留的測試入口（票 04）。找找看上線之後，視野鎖定只在出題期間由一局打開，
// 「擋得住使用者發起的縮放，擋不住第一段的自動放大」那條測試搬到了 `quiz-page.spec.ts`。
// 平面圖頁的網址不再是入口（M4 票 07）：加一個參數就把圖鎖死、畫面上又沒有任何東西解得開。
test("網址帶 ?fitLocked=1 不再鎖住視野：雙指縮放照常", async ({ page }) => {
  await page.goto(`${PLAN}?fitLocked=1`);
  // 等 client 接手、掛載後的 effect 都跑完（首次引導決定了要不要說）才縮放：
  // 在那之前雙指本來就沒有反應，量到的是「還沒接手」，不是「有沒有被鎖」。
  await expect(page.locator("#hotspot-layer")).toHaveAttribute("data-hint", /on|off/);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const center = { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };

  await pinch(page, center, 100, 250);
  expect((await plan.boundingBox())!.width, "雙指放大被網址參數擋下了").toBeCloseTo(fit.width * 2.5, 0);
});

test("關掉說明卡之後點回原處，是重新選一個，不是雙擊放大", async ({ page }) => {
  // 「兩下、很快、同一個地方」在手勢層看起來就是雙擊，但中間隔了一次關卡片——
  // 使用者的意思是重新看這一區。狀態機靠 lastTap 已經被清掉認得出這件事，
  // 手勢層記不得，所以這條界線不能放在手勢層（票 04 決議 1）。
  await page.goto(PLAN);

  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);
  const zoomed = (await door.boundingBox())!;
  const confirmAt = { x: zoomed.x + zoomed.width / 2, y: zoomed.y + zoomed.height / 2 };
  await page.mouse.click(confirmAt.x, confirmAt.y);

  const closeButton = page.locator("#info-sheet").getByRole("button", { name: "關閉說明" });
  const box = (await closeButton.boundingBox())!;
  // 用 page.mouse 直接點，中間不繞 locator：兩下之間要真的落在 300ms 的雙擊視窗裡，
  // 這條測試才問得到問題。
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(confirmAt.x, confirmAt.y);

  // 被誤判成雙擊的話，這一下只會縮放，狀態列會是空的（沒有人回應他點了什麼）。
  // 正確的行為是走一次新的第一段——不論那個位置有沒有東西，畫面上都會有話說。
  await expect(page.getByRole("status")).not.toHaveText("");
});

test("使用者自己調好的視野撐得過說明卡的開與關", async ({ page }) => {
  // `docs/adr/0003` 的欠帳：卡片升起是按 fit 的變化比例調整縮放，等於等比縮放使用者的視野，
  // 沒有把它丟掉——但 M2 在票 04 之前沒有自由縮放，這條路徑從沒被真的走過。這裡走一次。
  await page.goto(PLAN);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;

  await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);
  const mine = (await plan.boundingBox())!;
  expect(mine.width).toBeCloseTo(fit.width * 2, 0);

  // 放大之後只剩圖的中間那一塊在畫面上，所以選一個還看得到的符號：廚房的窗。
  const window_ = page.locator("#hs-win-kitchen");
  const box = (await window_.boundingBox())!;
  await page.mouse.click(box.x + box.width + 13, box.y + box.height / 2);
  const candidate = (await window_.boundingBox())!;
  await page.mouse.click(candidate.x + candidate.width / 2, candidate.y + candidate.height / 2);

  // 卡片升起：圖被擠進上方那條可視帶並等比縮小，但那不是「使用者的視野作廢了」。
  const sheet = page.locator("#info-sheet");
  await expect(sheet).toBeVisible();
  expect((await plan.boundingBox())!.width).toBeLessThan(mine.width);

  await sheet.getByRole("button", { name: "關閉說明" }).click();
  await expect(sheet).toBeHidden();

  // 卡片收起，圖長回使用者自己調好的那 2 倍——不是跳回全圖。
  await expect.poll(async () => Math.round((await plan.boundingBox())!.width)).toBe(
    Math.round(mine.width),
  );
  const after = (await plan.boundingBox())!;
  expect(after.x).toBeCloseTo(mine.x, 0);
  expect(after.y).toBeCloseTo(mine.y, 0);
});

test("滑鼠右鍵與中鍵不是檢視器的手勢（票 09）", async ({ page }) => {
  // 由 onClick 改成 pointer 手勢之後，右鍵也進得了手勢 session：使用者只是想開瀏覽器的
  // 右鍵選單，檢視器卻同時放大並圈出候選。要擋的是「非主鍵」，不是「非 primary pointer」——
  // 第二根觸控手指的 isPrimary 也是 false，濾掉它就沒有雙指縮放了。
  await page.goto(PLAN);
  const plan = planOf(page);
  const door = page.locator("#hs-door-entry");
  const fit = (await plan.boundingBox())!;
  const box = (await door.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  for (const button of ["right", "middle"] as const) {
    await page.mouse.click(center.x, center.y, { button });
    await expect(page.locator('[data-state="candidate"]'), `${button} 鍵不該圈出候選`).toHaveCount(0);
    await expect(page.locator('[data-state="selected"]')).toHaveCount(0);
    await expect(page.locator("#info-sheet")).toBeHidden();
    expect((await plan.boundingBox())!.width, `${button} 鍵不該改變倍率`).toBeCloseTo(fit.width, 0);
  }

  // 拖曳也一樣：右鍵／中鍵按著滑過去不該平移，那是瀏覽器自己的事。
  const frame = (await viewportOf(page).boundingBox())!;
  const from = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  for (const button of ["right", "middle"] as const) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down({ button });
    await page.mouse.move(from.x - 80, from.y, { steps: 8 });
    await page.mouse.up({ button });
    const after = (await plan.boundingBox())!;
    expect(after.x, `${button} 鍵拖曳不該平移圖面`).toBeCloseTo(fit.x, 0);
    expect(after.width).toBeCloseTo(fit.width, 0);
  }

  // 被擋掉的那幾下也不該留在雙擊的記帳裡：主鍵照樣只算一下，兩段式從第一段開始。
  await page.mouse.click(center.x, center.y);
  await expect(door).toHaveAttribute("data-state", "candidate");
});

/** 目標與可視區域重疊的那一塊。完全被推出畫面時是 null——那正是票 08 的症狀。 */
function visiblePart(target: BoundingBox, frame: BoundingBox): BoundingBox | null {
  const x = Math.max(target.x, frame.x);
  const y = Math.max(target.y, frame.y);
  const right = Math.min(target.x + target.width, frame.x + frame.width);
  const bottom = Math.min(target.y + target.height, frame.y + frame.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

// 票 08：說明卡展開之後，圖被壓成一條很矮的可視帶，fit 隨之變得很小。第一段若照那個框
// 把視野定好位，`fit × 3` 仍可能小於 1，clampView 就把中心夾回圖面正中央——使用者點的
// 那個位置在那一刻被丟掉了，而接在後面的 RESIZE 只調得回倍率，調不回已經沒有的中心。
//
// 原本還有一個「鎖定視野」的變體（`?fitLocked=1`），M4 票 07 刪掉了。鎖定視野只在找找看出題時打開，
// 而找找看裡這個情境不會發生：說明卡只在作答後打開、作答後圖暫停、「下一題」一律收起卡片——
// 最後一條由 `quiz-feedback.spec.ts`「說明卡展開著也一起收起」釘住。
test("展開說明卡後直接點圖上另一個符號，收合後仍然選得到它", async ({ page }) => {
  await page.goto(PLAN);
  const plan = planOf(page);

  // 雨遮是唯一有注意事項的符號，內容塞不下——「上拉看完整內容」只在它身上出現。
  await selectByTwoTaps(page, "hs-canopy-master");
  const withSheet = (await plan.boundingBox())!;
  await page.getByRole("button", { name: /上拉看完整內容/ }).click();
  // 卡片長高，圖被擠得更扁：等這一輪 RESIZE 走完，才是使用者看到的那個畫面。
  await expect
    .poll(async () => (await plan.boundingBox())!.height)
    .toBeLessThan(withSheet.height);

  // 圖面左下角的柱：邊緣的目標，正是被夾回中央時第一個掉出畫面的東西。
  const column = page.locator("#hs-col-sw");
  const tiny = (await column.boundingBox())!;
  await page.mouse.click(tiny.x + tiny.width / 2, tiny.y + tiny.height / 2);

  // 這一下是新的第一段：卡片收起來，圖長回來。
  await expect(page.locator("#info-sheet")).toBeHidden();
  await expect(column).toHaveAttribute("data-state", "candidate");
  await expect.poll(async () => (await plan.boundingBox())!.height).toBeGreaterThan(
    withSheet.height,
  );

  // 第二段要點得到它：不必先關卡片、不必重選、也不必自己把圖拖回來。
  const frame = (await viewportOf(page).boundingBox())!;
  const seen = visiblePart((await column.boundingBox())!, frame);
  expect(seen, "柱被推出畫面外了，第二段無從點起").not.toBeNull();
  await page.mouse.click(seen!.x + seen!.width / 2, seen!.y + seen!.height / 2);

  await expect(column).toHaveAttribute("data-state", "selected");
  await expect(page.locator("#info-sheet-name")).toHaveText("柱");
});
