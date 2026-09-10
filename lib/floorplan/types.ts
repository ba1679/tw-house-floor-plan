// FloorPlan 是由 layout 展開出來的具體圖面（CONTEXT.md）：座標、牆、開口、傢俱、熱區，
// 由 floorplan-generator 產生、commit 進 repo、不得手改。這裡只宣告檢視器現在真的會讀的欄位——
// 把整份 schema 抄成 TS 型別，抄來的那一份不會跟著產生器走。

/** 圖面座標系裡的一塊矩形，單位 cm。熱區、房間、viewBox 講的都是它。 */
export type PlanRect = { x: number; y: number; width: number; height: number };

/**
 * Hotspot（熱區）：floorplan 上一個可點擊的區域，指向一個 symbol。
 * 一個 symbol 在同一張圖上可以有多個 hotspot，每個 hotspot 有自己的全檔唯一 id。
 *
 * `symbol_id` 可以是 null——熱區位置已知、但還沒決定指向哪個符號（PRD §7.3）。
 * 檢視器對這種熱區安靜略過，M1 的內容查證還沒做完也能先上線看圖。
 */
export type Hotspot = {
  id: string;
  symbol_id: string | null;
  /** 目前資料只有 rect 一種；coords 是 [x, y, width, height]，單位 cm。 */
  shape: "rect";
  coords: [number, number, number, number];
};

/**
 * 房間。閱讀順序（`reading-order.ts`）拿它的幾何算出熱區的房間歸屬——
 * **歸屬不寫進 floorplan schema**：floorplan 由程式產生、不得手改，
 * 加一個欄位就要動 `expand_layout.py` 與所有既有產物。
 */
export type Room = {
  id: string;
  /** 房間型態，例如 `living_room`。集合由 floorplan-generator 決定，這裡不列舉。 */
  type: string;
  /** 給人看的房間名稱，例如「客廳」。 */
  name: string;
  /** **含牆厚**的外框。牆內那一塊是 `inner`，這裡用不到。 */
  geometry: PlanRect;
};

export type FloorPlan = {
  id: string;
  /** 給人看的格局名稱，例如「三房兩廳」。 */
  name: string;
  rooms: Room[];
  hotspots: Hotspot[];
};

/** SVG 的 viewBox：固定是整張圖，不隨操作改變（縮放與平移走 CSS transform）。 */
export type ViewBox = PlanRect;

/**
 * 圖面：平面圖畫出來的樣子——牆、房間、門窗、傢俱、標註。
 * 它是 floorplan 的一個投影，不是資料（CONTEXT.md）；熱區不在裡面，見 artwork.ts。
 */
export type FloorPlanArtwork = {
  viewBox: ViewBox;
  /** SVG 的內容（不含最外層 <svg> 標籤）。 */
  markup: string;
};
