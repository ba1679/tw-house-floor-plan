import { expect, type Page } from "@playwright/test";

// 在瀏覽器裡問檢視器的測試共用的幾個小工具：手勢怎麼做出來、熱區實際被畫成什麼樣。
//
// 座標一律從瀏覽器量到的框算起，這裡不自己算一次 cm → px（與 two-stage-tap.spec.ts 同一條規矩）。
// 換算層是這個檢視器最會壞的地方，測試若抄同一條公式，公式錯了兩邊會一起錯、一起過。

type Box = { x: number; y: number; width: number; height: number };

/**
 * 圖的最上緣、房子外面的那條留白。全圖時 46px 容錯換算成圖面約 160cm，
 * 而這裡離最近的熱區還有 200cm 以上——點下去不會有候選，第一段因此不會放大。
 * 雙擊要成立就需要這種地方：第一下什麼都沒選到，第二下才會被當成「放大這一區」。
 */
export const blankSpot = (frame: Box) => ({
  x: frame.x + frame.width * 0.7,
  y: frame.y + frame.height * 0.03,
});

/**
 * 雙指縮放。Playwright 的 touchscreen 只給得出單指，兩根手指要走 CDP。
 * 指距的比例就是縮放的倍率；中點固定，所以這是純縮放、不含平移。
 */
export async function pinch(page: Page, center: { x: number; y: number }, from: number, to: number) {
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
export async function dragLeft(page: Page, from: { x: number; y: number }, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - dx, from.y, { steps: 8 });
  await page.mouse.up();
}

/**
 * 兩段式選到指定熱區：點它的正中央圈出候選並放大，再點一次放大後的正中央確認。
 * 放大之後同一個熱區換了螢幕座標，所以第二下之前重新量，不自己推算（見檔頭）。
 *
 * 沒選中就在這裡帶訊息失敗：呼叫端後面的斷言都建立在「選到了這一個」上。回傳那個熱區，呼叫端接著量它。
 */
export async function selectByTwoTaps(page: Page, hotspotId: string) {
  const target = page.locator(`#${hotspotId}`);
  const before = (await target.boundingBox())!;
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
  const zoomed = (await target.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(target, `${hotspotId} 沒有被選中，後面的斷言都不算數`).toHaveAttribute(
    "data-state",
    "selected",
  );
  return target;
}

/** 熱區實際被畫成什麼樣子。測的是使用者看得到的東西，不是 class 名稱。 */
export const markingOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    return { fill: style.fill, stroke: style.stroke, strokeWidth: style.strokeWidth };
  });

/**
 * 這個東西在畫面上真的被畫出來了嗎。
 *
 * 兩種「沒畫」在 computed style 裡長得不一樣：`fill: transparent` 算成 `rgba(0, 0, 0, 0)`，
 * `stroke: none` 算成 `none`。只比對其中一種，另一種會安靜地通過——
 * 「沒有細邊」曾經因此被判成「有細邊」。
 */
export const painted = (value: string) => value !== "none" && value !== "rgba(0, 0, 0, 0)";
