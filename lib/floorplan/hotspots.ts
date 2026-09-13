import type { Hotspot, PlanRect } from "./types";

// 熱區的共用規則。每一條都被不只一處問到——「命中判定」與「畫面上的清單」、檢視器與符號頁——
// 而那幾處必須講同一件事：各寫一份的話，遲早有一邊多出或少掉一個熱區。

/**
 * 這個熱區有沒有指向一個 symbol。
 *
 * `symbol_id` 為 null 的熱區位置已知、但還沒決定指向哪個符號（PRD §7.3）。檢視器對它
 * **安靜略過**：不畫、不進候選、不計入「共 N 處」，也不進鍵盤的閱讀順序——
 * 一個念不出名字的東西擋在 Tab 路上，比沒有它更糟。
 */
export const hasSymbol = (hotspot: Hotspot) => hotspot.symbol_id !== null;

/**
 * 一個 symbol 在一張圖上的所有熱區，依 hotspots 的出現順序。
 *
 * 「這張圖上有沒有這個符號、有幾處」只有這一種算法（CONTEXT.md 的 `related_layouts`）：說明卡的「共 N 處」、
 * 落地時狀態列的處數，以及「一處都沒有」（`isSymbolAbsent`）都問它。
 */
export const hotspotsOfSymbol = (hotspots: Hotspot[], symbolId: string) =>
  hotspots.filter((h) => h.symbol_id === symbolId);

/**
 * 這個 symbol 在這張圖上一處都沒有。今天只有樑：建案平面圖不畫樑（PRD §4.2）。
 *
 * 符號頁的按鈕要不要改說「看不到」、檢視器落地時要不要出那條橫幅（M3 票 09），問的都是這一句——
 * 按鈕說看不到，進去就有橫幅。兩邊各寫一次 `.length === 0` 的話，這個保證就只剩註解在撐：
 * 會有一天按鈕說看不到、進去圖上卻亮了幾處，而兩頁各自看起來都正常。
 */
export const isSymbolAbsent = (hotspots: Hotspot[], symbolId: string) =>
  hotspotsOfSymbol(hotspots, symbolId).length === 0;

/** 熱區在圖面上佔的那塊矩形。coords 的四個數字只在這裡被拆開。 */
export const rectOf = (hotspot: Hotspot): PlanRect => ({
  x: hotspot.coords[0],
  y: hotspot.coords[1],
  width: hotspot.coords[2],
  height: hotspot.coords[3],
});
