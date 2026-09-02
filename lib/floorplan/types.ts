// FloorPlan 是由 layout 展開出來的具體圖面（CONTEXT.md）：座標、牆、開口、傢俱、熱區，
// 由 floorplan-generator 產生、commit 進 repo、不得手改。這裡只宣告檢視器現在真的會讀的欄位——
// 把整份 schema 抄成 TS 型別，抄來的那一份不會跟著產生器走。
// 熱區的型別等 02 真的畫熱區層時再加，那時它的形狀由命中判定決定，不由 JSON 決定。

export type FloorPlan = {
  id: string;
  /** 給人看的格局名稱，例如「三房兩廳」。 */
  name: string;
};

export type ViewBox = { x: number; y: number; width: number; height: number };

/**
 * 圖面：平面圖畫出來的樣子——牆、房間、門窗、傢俱、標註。
 * 它是 floorplan 的一個投影，不是資料（CONTEXT.md）；熱區不在裡面，見 artwork.ts。
 */
export type FloorPlanArtwork = {
  viewBox: ViewBox;
  /** SVG 的內容（不含最外層 <svg> 標籤）。 */
  markup: string;
};
