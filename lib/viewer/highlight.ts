// 轉換點的網址：符號頁寫、檢視器讀（M3 票 08）。
//
// 用 query、不用 hash、不開新路由（spec「轉換點與高亮」）：新路由會長出 14 個內容幾乎相同的
// 可索引網址；query 是框架支援的那條路（`useSearchParams`），爬蟲也看得出它是同一頁的參數。
//
// 參數名只寫在這裡一次。寫的一邊與讀的一邊各抄一份的話，改一邊漏一邊，按鈕照樣連得過去、
// 圖上卻什麼都不亮——而那一頁看起來完全正常。

/** `?symbol=<id>`：落地後把哪個符號在圖上的每一處都標成 `highlighted`。 */
export const HIGHLIGHT_PARAM = "symbol";

/**
 * 符號頁那顆按鈕的去處。
 * 格局 id 由呼叫端從 `related_layouts` 取來，這裡不挑——帶去哪張圖是資料裡的編輯決定（CONTEXT.md）。
 */
export const highlightHref = (layoutId: string, symbolId: string) =>
  `/layouts/${layoutId}?${new URLSearchParams({ [HIGHLIGHT_PARAM]: symbolId })}`;
