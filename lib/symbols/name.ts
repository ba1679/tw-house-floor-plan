import type { SymbolRecord } from "./types";

/**
 * 畫面上說出一個符號時用的字：資料裡的 `name`，查不到就落回 symbol id（`reading-order.ts` 的排序也照這個前提）。
 *
 * 圖框（熱區的替代文字）與自由看圖（狀態列、樑的橫幅）原本各寫一份一模一樣的（M4 票 01 review），
 * 改一份就漏一份。**念不念名字**不在這裡決定——那是圖框的 `names`（M4 票 03）；這裡只管念的話念哪個字。
 */
export const symbolName = (symbols: Record<string, SymbolRecord>, symbolId: string | null) =>
  (symbolId && symbols[symbolId]?.name) || symbolId || "";
