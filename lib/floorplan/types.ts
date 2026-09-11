// FloorPlan 是由 layout 展開出來的具體圖面（CONTEXT.md）：座標、牆、開口、傢俱、熱區，
// 由 floorplan-generator 產生、commit 進 repo、不得手改。這裡只宣告檢視器現在真的會讀的欄位——
// 把整份 schema 抄成 TS 型別，抄來的那一份不會跟著產生器走。
//
// 票 07 之後檢視器自己把圖畫出來（`components/FloorPlanRenderer.tsx`），所以「真的會讀的欄位」
// 從熱區擴張到了牆、門、窗、傢俱、柱、雨遮。**擴張的是讀取範圍，不是資料的地位**：
// JSON 仍然是唯一 source of truth，渲染只讀不寫（`docs/adr/0005`）。

/** 圖面座標系裡的一塊矩形，單位 cm。熱區、房間、viewBox 講的都是它。 */
export type PlanRect = { x: number; y: number; width: number; height: number };

/** 圖面座標系裡的一點，單位 cm。 */
export type PlanPoint = { x: number; y: number };

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
  /** 坪數，標在房名底下。產生器算好的，前台不重算——四捨五入的位數也是它的事。 */
  area_ping: number;
};

/**
 * 牆。`start`/`end` 走的是**牆心線**，所以畫出來的矩形要往兩側各長 thickness/2
 * （`drawing.ts` 的 `wallRect`）。
 */
export type Wall = {
  id: string;
  type: string;
  orientation: "horizontal" | "vertical";
  start: PlanPoint;
  end: PlanPoint;
  thickness: number;
};

/**
 * 門扇掃過的那道弧，由 `expand_layout.py` 算好。
 * renderer 不自己從 swing／rotation 推導——三邊各自推導遲早會漂移。
 */
export type SwingArc = {
  hinge: PlanPoint;
  radius: number;
  /** 沿牆、從鉸鏈指向門扇關上時的另一端（單位向量）。 */
  along: PlanPoint;
  /** 垂直牆、門扇全開時指的方向（單位向量）。 */
  open: PlanPoint;
};

/** 牆上的一段開口。門與窗共用這個形狀：都是「在某面牆的 offset 處佔 width 寬」。 */
type Opening = {
  id: string;
  /** 開在哪一面牆上。 */
  wall_id: string;
  /** 從牆的 start 沿牆量到開口起點的距離（cm）。 */
  offset: number;
  width: number;
};

export type Door = Opening & {
  /** `single` / `double` / `sliding` / `opening`。畫法逐型不同，見 renderer。 */
  type: string;
  /** 門朝哪一間房開。出入口的三角記號朝這一側。 */
  opens_to?: string;
  swing_arcs?: SwingArc[];
};

export type Window = Opening & {
  /** `sliding` / `fixed` / `casement`。 */
  type: string;
};

export type Furniture = {
  id: string;
  type: string;
  room_id: string;
  geometry: PlanRect;
  /** 0 / 90 / 180 / 270。0 是「背面朝上」，逆時針增加（`drawing.ts` 的 `fixtureFrame`）。 */
  rotation: number;
};

/** 柱。與牆同層、同形狀，差別只在填色深淺——那是「柱不能打掉」在圖上唯一看得出來的地方。 */
export type Column = { id: string; geometry: PlanRect };

/** 雨遮：外牆之外的外挑構造。座標可以是負的，viewBox 要把它算進留白。 */
export type Canopy = { id: string; geometry: PlanRect };

/**
 * 尺寸標註。目前資料只有整體寬高兩條，`label` 是標在線上的字——
 * **字取自資料，不由座標重算**：四捨五入與單位寫法是產生器的事。
 */
export type Annotation = {
  id: string;
  type: string;
  start: PlanPoint;
  end: PlanPoint;
  label: string;
};

/** 權狀與室內面積。圖名底下那一行寫的就是它。 */
export type AreaMeta = {
  deed_ping?: number;
  public_ratio?: number;
  interior_ping?: number;
  interior_m2?: number;
};

export type FloorPlan = {
  id: string;
  /** 給人看的格局名稱，例如「三房兩廳」。 */
  name: string;
  /** 室內外框，原點在左上。留白（尺寸線、雨遮、開啟弧）在這個框之外。 */
  bounds: { width: number; height: number };
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  columns?: Column[];
  canopies?: Canopy[];
  annotations?: Annotation[];
  area_meta?: AreaMeta;
  hotspots: Hotspot[];
};

/** SVG 的 viewBox：固定是整張圖，不隨操作改變（縮放與平移走 CSS transform）。 */
export type ViewBox = PlanRect;
