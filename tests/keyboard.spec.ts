import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { blankSpot } from "./viewer-page";

// 兩段式點擊升為全站的基礎操作之後，它是**所有人看圖的唯一方式**——所以鍵盤必須有一條
// 完整的平行路徑，否則這個網站對鍵盤使用者等於不存在（票 06）。
// 鍵盤路徑不走兩段式：兩段式解的是手指精度問題，鍵盤沒有這個問題。
//
// 順序的預期不在這裡重算一次。測試讀的是**頁面自己宣稱的房間歸屬**（`data-room`），
// 再拿 floorplan 與 symbols 兩份資料去驗那個順序符不符合規則——抄一份同樣的演算法進測試，
// 演算法錯了兩邊會一起錯、一起過（與 two-stage-tap.spec.ts 不自己算 cm → px 同一條規矩）。

const PLAN = "/layouts/3b2l_standard";

type Box = { x: number; y: number; width: number; height: number };
type Hotspot = { id: string; symbol_id: string | null; coords: [number, number, number, number] };
type Room = { id: string; name: string; geometry: Box };

const floorplan = JSON.parse(
  readFileSync("data/layouts/3b2l_standard.floorplan.json", "utf8"),
) as { rooms: Room[]; hotspots: Hotspot[] };

const symbols = (
  JSON.parse(readFileSync("data/symbols.sample.json", "utf8")) as {
    symbols: { id: string; name: string; category: string }[];
  }
).symbols;

/** symbol_id 為 null 的熱區不畫、不進候選（PRD §7.3），因此也不該有焦點。 */
const readable = floorplan.hotspots.filter((h) => h.symbol_id !== null);

const symbolOf = (h: Hotspot) => symbols.find((s) => s.id === h.symbol_id)!;
const roomName = (id: string) => floorplan.rooms.find((r) => r.id === id)!.name;

/** 結構 → 門窗 → 家具家配。這是「房間內依符號類別」那條規則的內容。 */
const CATEGORY_ORDER = ["structure", "door_window", "furniture"];

/**
 * 看屋時一間一間看的動線：進門、公共區、然後沿走道一間一間進私密區。
 * 沒有熱區的房間不會出現在 Tab 序列裡，所以觀察到的順序是這一串的**子序列**。
 */
const TOUR = [
  "玄關",
  "客廳",
  "餐廳",
  "廚房",
  "後陽台",
  "走道",
  "小孩房", // 新圖北側私領域先於南側；南排再由西向東。
  "客浴",
  "主浴",
  "主臥",
  "次臥",
  "管道間",
];

/**
 * 這個熱區有沒有落在任何一間房裡。**這不是歸屬演算法的第二份**——歸屬要挑的是哪一間，
 * 這裡只問「有沒有」，而「雨遮、外牆、外側的窗」該排在房間最後正是由它決定的。
 */
const isOutside = (h: Hotspot) =>
  !floorplan.rooms.some((r) => {
    const [x, y, w, ht] = h.coords;
    const g = r.geometry;
    return (
      Math.min(x + w, g.x + g.width) > Math.max(x, g.x) &&
      Math.min(y + ht, g.y + g.height) > Math.max(y, g.y)
    );
  });

/** 圖前面最多有幾個可聚焦的東西要先 Tab 過去。今天只有標題列上找找看的入口（M4 票 06）。 */
const BEFORE_PLAN_STOPS = 10;

/**
 * Tab 一路走到底，記下每一站停在哪個熱區、頁面說它屬於哪一間房。
 *
 * 圖前面可以有別的可聚焦的東西——標題列排在圖的上面，Tab 先經過它是對的（焦點順序跟著畫面由上而下）。
 * 所以走到第一個熱區才開始記；之後遇到第一個不是熱區的東西就停：熱區之間不該夾著任何別的東西。
 */
async function tabThroughHotspots(page: Page) {
  const stops: { id: string; room: string }[] = [];
  const ids = new Set(readable.map((h) => h.id));
  for (let i = 0; i < readable.length + BEFORE_PLAN_STOPS; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !(el instanceof SVGElement)) return null;
      return { id: el.id, room: el.closest("[data-room]")?.getAttribute("data-room") ?? "" };
    });
    if (!stop || !ids.has(stop.id)) {
      if (stops.length === 0) continue;
      break;
    }
    stops.push(stop);
  }
  return stops;
}

const viewportOf = (page: Page) => page.locator("#floorplan-viewport");
const planOf = (page: Page) => page.getByRole("group", { name: /三房兩廳/ });

test("Tab 一間房一間房走過所有符號，順序對上看屋的動線", async ({ page }) => {
  await page.goto(PLAN);

  const stops = await tabThroughHotspots(page);

  // 走得完整張圖，而且每個熱區只走一次——這是「鍵盤使用者能看完整張圖」的最低要求。
  expect(stops.map((s) => s.id).sort()).toEqual(readable.map((h) => h.id).sort());

  // 一間房走完就不再回來：連在一起的一段就是一間房。
  const rooms = stops.map((s) => roomName(s.room)).filter((name, i, all) => name !== all[i - 1]);
  expect(new Set(rooms).size, "同一間房在 Tab 序列裡出現了不只一段").toBe(rooms.length);

  // 房間的先後對上看屋的動線。
  expect(rooms).toEqual(TOUR.filter((name) => rooms.includes(name)));
});

test("同一間房裡依結構 → 門窗 → 家具，落在房間之外的排在最後", async ({ page }) => {
  await page.goto(PLAN);

  const stops = await tabThroughHotspots(page);
  const byRoom = new Map<string, Hotspot[]>();
  for (const stop of stops) {
    const hotspot = readable.find((h) => h.id === stop.id)!;
    byRoom.set(stop.room, [...(byRoom.get(stop.room) ?? []), hotspot]);
  }

  // 沒有這一條，一個 Tab 都走不到的頁面會讓底下的迴圈空轉、然後宣告通過。
  expect(byRoom.size, "Tab 沒有走到任何熱區，底下的斷言等於沒跑").toBeGreaterThan(1);

  for (const [room, hotspots] of byRoom) {
    const where = `${roomName(room)}：${hotspots.map((h) => symbolOf(h).name).join(" → ")}`;

    // 雨遮、外牆這種掛在房子外緣的東西排在最後：房間裡實際有的東西先走完。
    const outside = hotspots.map(isOutside);
    expect(outside, where).toEqual([...outside].sort((a, b) => Number(a) - Number(b)));

    const ranks = hotspots
      .filter((h) => !isOutside(h))
      .map((h) => CATEGORY_ORDER.indexOf(symbolOf(h).category));
    expect(ranks, where).toEqual([...ranks].sort((a, b) => a - b));
  }
});

test("每個熱區都報得出自己是什麼符號", async ({ page }) => {
  await page.goto(PLAN);

  // 替代文字取自 symbol 資料的 name，不在元件裡寫死。
  await expect(page.locator("#hs-door-entry")).toHaveAccessibleName("雙開門");
  await expect(page.locator("#hs-f-counter")).toHaveAccessibleName("廚具");

  const unnamed = await page.evaluate(
    (ids) => ids.filter((id) => !document.getElementById(id)?.getAttribute("aria-label")),
    readable.map((h) => h.id),
  );
  expect(unnamed, "這些熱區沒有替代文字，讀螢幕的人不知道游標停在什麼上面").toEqual([]);
});

test("熱區歸到圖上實際所在的那一間房", async ({ page }) => {
  await page.goto(PLAN);

  // 上面兩條測的是「頁面自己宣稱的房間」排得對不對——歸屬本身算錯了它們照樣會過。
  // 歸屬只能拿人看得懂的事實來對，所以這裡列的每一筆都是站在圖前面指得出來的，
  // 而且刻意挑了會分岔的那幾個：跨在兩間房中間的門、畫在牆上的窗、掛在房子外面的雨遮。
  const expected: Record<string, string> = {
    "hs-door-entry": "玄關",
    "hs-win-living": "客廳", // 窗畫在牆上、一半落在房間的幾何裡：它屬於它照亮的那一間
    "hs-door-hall-living": "客廳", // 開口跨在客廳與走道中間，歸它通往的那個空間
    "hs-f-counter": "廚房",
    "hs-door-master": "主臥", // 門跨在走道與主臥中間。五扇門若全歸走道，就成了五次「一般單開門」
    "hs-door-bed3": "小孩房", // 玄關面積更小，仍應依 opens_to 歸到小孩房。
    "hs-f-toilet-m": "主浴",
    "hs-canopy-master": "主臥", // 整個掛在房子外面：離主臥與主浴一樣近，取重心較近的主臥
    "hs-room-ps": "管道間",
  };

  const actual = await page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          document.getElementById(id)?.closest("[data-room]")?.getAttribute("aria-label") ?? "",
        ]),
      ),
    Object.keys(expected),
  );

  expect(actual).toEqual(expected);
});

test("Enter 開說明卡、Esc 關卡，焦點回到原本的熱區", async ({ page }) => {
  await page.goto(PLAN);

  const door = page.locator("#hs-door-entry");
  const sheet = page.locator("#info-sheet");

  await door.focus();
  await page.keyboard.press("Enter");

  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("雙開門");
  // 焦點移入卡片：接下來讀到的是卡片的內容，不是圖上的下一個熱區。
  await expect(sheet).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(sheet).toBeHidden();
  // 回到原本那個熱區——不然使用者得從第一間房重新 Tab 一次才能繼續看。
  await expect(door).toBeFocused();
});

test("鍵盤不走兩段式：一次 Enter 就開卡，不必先放大再確認", async ({ page }) => {
  await page.goto(PLAN);

  const plan = planOf(page);
  const before = (await plan.boundingBox())!;

  await page.locator("#hs-f-bathtub-m").focus();
  await page.keyboard.press("Enter");

  await expect(page.locator("#info-sheet")).toContainText("浴缸");
  await expect(page.locator("#hs-f-bathtub-m")).toHaveAttribute("data-state", "selected");
  // 說明卡升起來會把圖擠小（票 03），但沒有第一段那次自動放大：圖只會變小、不會變大。
  expect((await plan.boundingBox())!.width).toBeLessThanOrEqual(before.width);
});

test("焦點移到畫面外的熱區時，圖自動平移讓它看得見", async ({ page }) => {
  await page.goto(PLAN);

  // 全圖時整張圖都在畫面上，沒有東西需要平移——先放大一級，把圖的一角推出畫面。
  const fit = (await planOf(page).boundingBox())!;
  await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);

  const frame = (await viewportOf(page).boundingBox())!;
  const corner = page.locator("#hs-col-sw");
  const before = (await corner.boundingBox())!;
  expect(
    before.y > frame.y + frame.height || before.x + before.width < frame.x,
    "這個熱區放大後本來就在畫面上，這條測試沒測到東西",
  ).toBe(true);

  await corner.focus();

  const after = (await corner.boundingBox())!;
  expect(after.x).toBeGreaterThanOrEqual(frame.x - 1);
  expect(after.y).toBeGreaterThanOrEqual(frame.y - 1);
  expect(after.x + after.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
  expect(after.y + after.height).toBeLessThanOrEqual(frame.y + frame.height + 1);

  // 平移是我們自己算的（view.ts），不是瀏覽器捲了那個框——那兩者會互相打架，
  // 而瀏覽器捲出來的位移不在狀態裡，命中判定看不見它。
  const scrolled = await viewportOf(page).evaluate((el) => el.scrollTop + el.scrollLeft);
  expect(scrolled).toBe(0);
});

test("焦點所在的熱區，畫面上看得出來", async ({ page }) => {
  await page.goto(PLAN);

  // 用 Tab 走到第一個熱區，不直接 focus()：這條問的是鍵盤使用者看到的焦點。圖前面的東西（標題列）先 Tab 過去。
  const focused = page.locator("#hs-door-entry");
  for (let i = 0; i < BEFORE_PLAN_STOPS; i++) {
    await page.keyboard.press("Tab");
    if (await focused.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(focused).toBeFocused();

  const strokeOf = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));

  // 焦點狀態要比一般狀態明顯：鍵盤使用者正在移動的那一個，是畫面上最該被看到的東西。
  expect(await strokeOf(focused)).toBeGreaterThan(await strokeOf(page.locator("#hs-win-living")));
});

test("鍵盤開過卡片之後改用手指，卡片不再搶走焦點", async ({ page }) => {
  await page.goto(PLAN);
  const sheet = page.locator("#info-sheet");
  const band = async () => Math.round((await viewportOf(page).boundingBox())!.height);
  const full = await band();

  // 先用鍵盤開一張卡片：「這張卡是從哪個熱區來的」因此被記了下來。
  const bathtub = page.locator("#hs-f-bathtub-m");
  await bathtub.focus();
  await page.keyboard.press("Enter");
  await expect(sheet).toBeFocused();

  // 不按 Esc，直接用手指點圖上別的地方——「重選」不是看下一個符號的必經步驟（PRD §11 #20），
  // 而這條路不經過關閉鍵，記下來的那個熱區沒有人會替它收尾。
  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);
  // 卡片收起來、圖長回整條可視帶之後才量得準（票 03 決議 3）。
  await expect(sheet).toBeHidden();
  await expect.poll(band).toBe(full);

  const zoomed = (await door.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(sheet).toContainText("雙開門");

  // 手指使用者看不到焦點框，把焦點搬進卡片對他沒有意義；
  // 而關掉之後若還跳回浴缸，那是他從頭到尾沒有碰過的一個熱區。
  await expect(sheet).not.toBeFocused();
  await sheet.getByRole("button", { name: "關閉說明" }).click();
  await expect(bathtub).not.toBeFocused();
});
