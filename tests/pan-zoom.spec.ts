import { test, expect, type Page } from "@playwright/test";

// pan/zoom 是「看得清楚」，兩段式點擊是「點得到」——兩件事都要有（PRD §6.1.1、票 04）。
// 這一組測的是使用者自己發起的手勢，以及它與兩段式之間那條界線：
// 拖曳不是點擊、雙擊不是兩次點擊、放大之後 46 CSS px 仍然是 46 CSS px。
//
// 座標一律從瀏覽器量到的框算起，測試不自己算一次 cm → px（與 two-stage-tap.spec.ts 同一條規矩）。
// 換算層是這個檢視器最會壞的地方，測試若抄同一條公式，公式錯了兩邊會一起錯、一起過。

const PLAN = "/layouts/3b2l_standard";

const planOf = (page: Page) => page.getByRole("img", { name: /三房兩廳/ });
const viewportOf = (page: Page) => page.locator("#floorplan-viewport");

/**
 * 圖的最上緣、房子外面的那條留白。全圖時 46px 容錯換算成圖面約 160cm，
 * 而這裡離最近的熱區還有 200cm 以上——點下去不會有候選，第一段因此不會放大。
 * 雙擊要成立就需要這種地方：第一下什麼都沒選到，第二下才會被當成「放大這一區」。
 */
const blankSpot = (frame: { x: number; y: number; width: number; height: number }) => ({
  x: frame.x + frame.width * 0.7,
  y: frame.y + frame.height * 0.03,
});

/**
 * 雙指縮放。Playwright 的 touchscreen 只給得出單指，兩根手指要走 CDP。
 * 指距的比例就是縮放的倍率；中點固定，所以這是純縮放、不含平移。
 */
async function pinch(page: Page, center: { x: number; y: number }, from: number, to: number) {
  const cdp = await page.context().newCDPSession(page);
  const touchPoints = (gap: number) => [
    { x: center.x - gap / 2, y: center.y, id: 0 },
    { x: center.x + gap / 2, y: center.y, id: 1 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: touchPoints(from) });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: touchPoints(from + ((to - from) * i) / steps),
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** 從 from 往左拖 dx 個 CSS px。一次手勢拖不動的距離要分段——手指也離不開畫面。 */
async function dragLeft(page: Page, from: { x: number; y: number }, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - dx, from.y, { steps: 8 });
  await page.mouse.up();
}

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

test("fitLocked：擋得住使用者發起的縮放，擋不住第一段的自動放大", async ({ page }) => {
  // 找找看（M4）鎖住視野，題目才不會被「自己放大來找」破解；但兩段式是作答的機制本身，
  // 它的自動 3× 照常發生。M2 不接 UI，用網址參數把這個輸入打開來測（票 04）。
  await page.goto(`${PLAN}?fitLocked=1`);
  const plan = planOf(page);
  const fit = (await plan.boundingBox())!;
  const center = { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };

  await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);
  expect((await plan.boundingBox())!.width, "雙擊放大應該被擋下").toBeCloseTo(fit.width, 0);

  await pinch(page, center, 100, 300);
  expect((await plan.boundingBox())!.width, "雙指放大應該被擋下").toBeCloseTo(fit.width, 0);

  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);

  const zoomed = (await door.boundingBox())!;
  expect(zoomed.width, "第一段的自動 3× 不該被 fitLocked 擋住").toBeGreaterThan(
    before.width * 2.5,
  );
  await expect(door).toHaveAttribute("data-state", "candidate");

  // 拖曳也擋。擋了縮放卻放行平移，使用者只要點一下拿到第一段的 3×，
  // 就能用那個倍率把整張圖逛完——鎖住視野要防的正是這件事。
  const frame = (await viewportOf(page).boundingBox())!;
  await dragLeft(page, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, 80);
  const dragged = (await door.boundingBox())!;
  expect(dragged.x, "鎖住視野時拖曳不該移動圖面").toBeCloseTo(zoomed.x, 0);

  await page.mouse.click(dragged.x + dragged.width / 2, dragged.y + dragged.height / 2);
  await expect(page.getByRole("status")).toContainText("雙開門");
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
