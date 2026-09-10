import type { Hotspot, PlanRect } from "./types";

// 熱區的兩條共用規則。兩者都被「命中判定」與「畫面上的清單」各用一次，
// 而那兩份清單必須講同一件事——各寫一份的話，遲早有一邊多出或少掉一個熱區。

/**
 * 這個熱區有沒有指向一個 symbol。
 *
 * `symbol_id` 為 null 的熱區位置已知、但還沒決定指向哪個符號（PRD §7.3）。檢視器對它
 * **安靜略過**：不畫、不進候選、不計入「共 N 處」，也不進鍵盤的閱讀順序——
 * 一個念不出名字的東西擋在 Tab 路上，比沒有它更糟。
 */
export const hasSymbol = (hotspot: Hotspot) => hotspot.symbol_id !== null;

/** 熱區在圖面上佔的那塊矩形。coords 的四個數字只在這裡被拆開。 */
export const rectOf = (hotspot: Hotspot): PlanRect => ({
  x: hotspot.coords[0],
  y: hotspot.coords[1],
  width: hotspot.coords[2],
  height: hotspot.coords[3],
});
