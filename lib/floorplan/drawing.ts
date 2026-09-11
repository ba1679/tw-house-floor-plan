import type { FloorPlan, PlanPoint, PlanRect, Room, ViewBox, Wall } from "./types";

// 把 floorplan 畫成平面圖需要的幾何與製圖常數。**這裡只有算式，沒有一個 React 元件**——
// 畫法依據《室內設計裝修製圖規範》（NAID），逐項出處見 docs/reference/naid-symbols.md，
// 而規範講的是幾何與線寬，不是 JSX。分在這裡，這些規則才驗得起來、也讀得出來。
//
// 對照組是 floorplan-generator 的 `render_svg.py`：它自稱冒煙測試 renderer，
// 而它的 docstring 也寫著正式站的 renderer「畫法可以不同」（`docs/adr/0005`）。
// 相同的是**依據**——線寬階層、座標系、開啟弧的幾何都照它；不同的是畫法上的取捨。

/** 圖面留白（cm），放尺寸線、圖名與伸出建物之外的開啟弧。 */
const MARGIN = 110;

// --- 線寬階層（p47 表 24，以 S:1/50 為基準）-------------------------------
// 本專案 SVG 座標＝世界座標 cm、圖面比例 1/50，所以 stroke-width(cm) = 筆粗(mm) × 5。
// LW 存的就是這個換算後的標準值，不要在別處寫 magic number。
const LW = {
  /** 0.6mm 特粗：RC／磚造主要結構剖、輪廓線——牆、梁、柱 */
  structure_cut: 3.0,
  /** 0.4mm 粗實：主要結構立面線 */
  structure_elev: 2.0,
  /** 0.3mm 中粗：主要裝修建材、主要家具外圍線、輕隔間 */
  major: 1.5,
  /** 0.2mm 中實：高程線、窗台線、門框、窗框 */
  frame: 1.0,
  /** 0.1mm 細實：家具次要副線、尺寸標註線 */
  minor: 0.5,
  /** 0.05mm 微細：材質剖面線、面材紋理線 */
  hair: 0.25,
} as const;

/**
 * 表 24 的筆粗是給「列印在 1/50 圖紙上」用的，0.1mm 細實線在螢幕上等於看不見。
 * 這個倍率只放大絕對值，不動相對關係——階層仍然是表 24 的階層。列印時設回 1。
 */
const LINE_SCALE = 2.5;

/** 表 24 的線寬，換算成圖面 cm。線寬跟著縮放一起變粗，因為它是圖面上的線，不是畫面上的標示。 */
export const lineWidth = (key: keyof typeof LW): number => LW[key] * LINE_SCALE;

// --- CAD 圖層代號（p46 表 23）---------------------------------------------
// 畫在 `data-layer` 上，之後要做分層開關不必回頭改渲染。活動家具 FUM 與固定家具 FUF
// 在標準裡是兩個圖層——買房時「附不附」看的就是這條線。
export const LAYER = {
  floor: "FL",
  wall: "WL",
  window: "WI",
  door: "DR",
  furnMovable: "FUM",
  furnFixed: "FUF",
  dimension: "SI",
  text: "TE",
} as const;

/** 濕區：地板填色與乾區不同。 */
export const WET_ROOMS = new Set(["bathroom", "kitchen"]);

// 高度語意（p25 表 10 備考）。平面圖是離地 120~150cm 平切下視，所以：
//   高櫃被切到 → 矩形內畫 X；吊櫃／壁掛在切面以上 → 虛線。
// 分類本身與 floorplan-generator 的 rules/furniture.md、expand_layout.py 的碰撞規則同源。
export const TALL_FURNITURE = new Set(["wardrobe", "refrigerator"]);
export const WALL_MOUNTED_FURNITURE = new Set(["tv"]);
/** 固定家具（表 23 圖層 08 FUF）；其餘是活動家具（圖層 07 FUM）。 */
export const FIXED_FURNITURE = new Set([
  "kitchen_counter",
  "wardrobe",
  "toilet",
  "sink",
  "bathtub",
  "shower",
]);

// 空間代號（p48 表 25）。真實建案平面圖上就是這樣標，認得代號本身就是教學目標。
// hallway（走道）與 study（書房）在表 25 沒有對應代號，留空。
// 管道間：表 25 作 I.P、表 28 作 PS（Pipe Shaft）；建案平面圖上普遍寫 PS。
const ROOM_CODES: Record<string, string> = {
  living_room: "L",
  dining_room: "D",
  kitchen: "K",
  bedroom: "B.R",
  master_bedroom: "M.B.R",
  bathroom: "W.C",
  balcony: "BAL",
  storage: "S",
  entrance: "ENTRY",
  pipe_shaft: "PS",
};

/** 表 25 把 W.C（廁所）與 BATH（浴室）列為兩個代號，差別在有沒有洗澡的設備。 */
const BATHING = new Set(["shower", "bathtub"]);

/**
 * 這間房在圖上標的空間代號，沒有對應代號時是 null。
 *
 * 台灣習慣把有無浴缸的都統稱「衛浴」，但標代號時要照實際配置分——標錯等於教錯。
 */
export function roomCode(room: Room, fixtureTypes: Set<string>): string | null {
  const code = ROOM_CODES[room.type];
  if (!code) return null;
  if (code === "W.C" && [...fixtureTypes].some((t) => BATHING.has(t))) return "BATH";
  return code;
}

/** 圖上文字的基準字級（cm）。房名用它，其餘的字都是它的比例。 */
export const baseFontSize = (bounds: FloorPlan["bounds"]) =>
  Math.max(20, Math.trunc(bounds.width * 0.026));

/**
 * 整張圖的 viewBox：室內外框加上四邊各自算出來的留白。
 *
 * 留白**逐邊算**而不是四邊都用 MARGIN：平開窗的開啟弧向室外側開、半徑等於窗寬，
 * 會伸出建物之外；雨遮整個就在建物之外。少算這兩者，viewBox 會把它們裁掉——
 * 而畫面上只看得到「那扇窗怎麼少一半」，看不出原因。
 */
export function planViewBox(plan: FloorPlan): ViewBox {
  const { width: W, height: H } = plan.bounds;
  const wallById = new Map(plan.walls.map((w) => [w.id, w]));
  const pad = { n: MARGIN, s: MARGIN, e: MARGIN, w: MARGIN };

  for (const win of plan.windows) {
    if (win.type !== "casement") continue;
    const wall = wallById.get(win.wall_id);
    if (!wall) continue;
    const side =
      wall.orientation === "horizontal"
        ? wall.start.y < H / 2
          ? "n"
          : "s"
        : wall.start.x < W / 2
          ? "w"
          : "e";
    pad[side] = Math.max(pad[side], win.width + wall.thickness / 2 + MARGIN);
  }

  for (const canopy of plan.canopies ?? []) {
    const g = canopy.geometry;
    if (g.y < 0) pad.n = Math.max(pad.n, -g.y + MARGIN);
    if (g.x < 0) pad.w = Math.max(pad.w, -g.x + MARGIN);
    if (g.y + g.height > H) pad.s = Math.max(pad.s, g.y + g.height - H + MARGIN);
    if (g.x + g.width > W) pad.e = Math.max(pad.e, g.x + g.width - W + MARGIN);
  }

  return { x: -pad.w, y: -pad.n, width: W + pad.w + pad.e, height: H + pad.n + pad.s };
}

/**
 * 圖面之外那一圈東西的位置：尺寸線、圖名、指北針。
 *
 * 跟 viewBox 算在同一個地方，因為它們全都是同一組留白推出來的——分開算，
 * 改了留白之後圖名會靜靜地跑到紙外面去。
 */
export type PlanFrame = {
  viewBox: ViewBox;
  /** 水平尺寸線的 y（圖面上方留白裡）。 */
  dimensionTop: number;
  /** 垂直尺寸線的 x（圖面左方留白裡）。 */
  dimensionLeft: number;
  /** 圖名那一行的基線（圖面下方留白裡）。 */
  titleBaseline: number;
  /** 面積假設那一行的基線，在圖名底下。 */
  subtitleBaseline: number;
  /** 指北針：圖面右上角的留白裡（p16 §10(a)：平面配置圖應標示指北針，上方為北）。 */
  northArrow: { cx: number; cy: number; r: number };
};

export function planFrame(plan: FloorPlan): PlanFrame {
  const viewBox = planViewBox(plan);
  return {
    viewBox,
    dimensionTop: viewBox.y + MARGIN * 0.55,
    dimensionLeft: viewBox.x + MARGIN * 0.55,
    titleBaseline: viewBox.y + viewBox.height - MARGIN * 0.5,
    subtitleBaseline: viewBox.y + viewBox.height - MARGIN * 0.18,
    northArrow: {
      cx: viewBox.x + viewBox.width - MARGIN * 0.55,
      cy: viewBox.y + MARGIN * 0.55,
      r: MARGIN * 0.24,
    },
  };
}

/** 牆畫出來的矩形。start/end 走牆心線，所以兩側各長 thickness/2。 */
export function wallRect(wall: Wall): PlanRect {
  const t = wall.thickness;
  const { start: s, end: e } = wall;
  if (wall.orientation === "horizontal") {
    return { x: s.x - t / 2, y: s.y - t / 2, width: e.x - s.x + t, height: t };
  }
  return { x: s.x - t / 2, y: s.y - t / 2, width: t, height: e.y - s.y + t };
}

/**
 * 開口在牆上佔的那一段——用來把牆挖空。
 *
 * 挖的範圍比牆厚多一點（`pad`）：不多挖的話，建物輪廓線的一半會留在開口上，
 * 看起來像門窗被一條線攔腰劃過。
 */
export function openingBox(
  opening: { offset: number; width: number },
  wall: Wall,
  pad = lineWidth("structure_cut") / 2 + 1,
): PlanRect {
  const t = wall.thickness + pad * 2;
  const s = wall.start;
  if (wall.orientation === "horizontal") {
    return { x: s.x + opening.offset, y: s.y - t / 2, width: opening.width, height: t };
  }
  return { x: s.x - t / 2, y: s.y + opening.offset, width: t, height: opening.width };
}

/**
 * 開口的區域座標系：原點在開口起點的牆心線上，`a` 沿牆、`b` 垂直牆。
 * 有了它，水平牆與垂直牆的畫法只要寫一次。
 */
export type OpeningFrame = {
  at(a: number, b: number): PlanPoint;
  /** 沿牆的單位向量。 */
  along: PlanPoint;
  /** 垂直牆的單位向量。 */
  normal: PlanPoint;
};

export function openingFrame(opening: { offset: number }, wall: Wall): OpeningFrame {
  const s = wall.start;
  const horizontal = wall.orientation === "horizontal";
  const origin = horizontal
    ? { x: s.x + opening.offset, y: s.y }
    : { x: s.x, y: s.y + opening.offset };
  const along = horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const normal = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
  return {
    along,
    normal,
    at: (a, b) => ({
      x: origin.x + along.x * a + normal.x * b,
      y: origin.y + along.y * a + normal.y * b,
    }),
  };
}

/**
 * 外牆的室外側落在 `+normal` 還是 `-normal`（回傳 +1 / −1）。
 *
 * 窗只開在外牆，而外牆一定貼在 bounds 邊上，所以「離開圖面中心」就是室外。
 * 平開窗的開啟弧依規範向室外側開（p24 表 9）。
 */
export function exteriorSign(wall: Wall, bounds: FloorPlan["bounds"], normal: PlanPoint): 1 | -1 {
  const ext =
    wall.orientation === "horizontal"
      ? wall.start.y < bounds.height / 2
        ? { x: 0, y: -1 }
        : { x: 0, y: 1 }
      : wall.start.x < bounds.width / 2
        ? { x: -1, y: 0 }
        : { x: 1, y: 0 };
  return ext.x * normal.x + ext.y * normal.y > 0 ? 1 : -1;
}

/**
 * 弧從 `from` 畫到 `to`、而且要朝 `bulge` 的方向鼓出去時，SVG 的 sweep-flag 該填 0 還是 1。
 *
 * 同樣兩個端點、同樣半徑之間有**兩個** 90° 弧，一個鼓向這邊、一個鼓向那邊，
 * sweep-flag 決定取哪一個。**取錯不會報錯，只會畫錯**（門會看起來往牆裡凹），
 * 所以這件事算出來，不靠手寫常數。
 */
export function arcSweep(from: PlanPoint, to: PlanPoint, bulge: PlanPoint): 0 | 1 {
  const cross = (to.x - from.x) * bulge.y - (to.y - from.y) * bulge.x;
  return cross > 0 ? 0 : 1;
}

/**
 * 傢俱自己的座標系。`u` 從背面 0 到正面 1，`v` 從左 0 到右 1（以「背面朝上」的視角）。
 *
 * 有了它，馬桶的水箱、洗臉盆的牆線、床的枕頭側都只要寫一次，四個朝向自動成立——
 * 而 `render_svg.py` 是為每個朝向各寫一條 if。
 */
export type FixtureFrame = {
  at(u: number, v: number): PlanPoint;
  /** (u0,v0)–(u1,v1) 圍出來的軸向矩形。 */
  rect(u0: number, v0: number, u1: number, v1: number): PlanRect;
  /**
   * 「橫向半徑、縱深半徑」換成 SVG 的 rx / ry。
   * 弧與橢圓的半徑是**世界座標軸**上的量，不是傢俱自己那兩軸——朝向一轉就得對調，
   * 而對調錯了畫出來只是一個比例怪怪的橢圓，不會報錯。
   */
  radii(span: number, depth: number): { rx: number; ry: number };
  /** 背面→正面的單位向量。弧要往哪一邊鼓，問它。 */
  front: PlanPoint;
  /** 背面→正面的深度、橫向的寬度（cm）。 */
  depth: number;
  span: number;
};

// rotation 0 是「背面朝上」，逆時針增加（螢幕座標 y 向下）。**只認得這四個朝向**——
// 那不是偷懶，是資料的事實：hotspot 的 coords 本來就是軸向矩形，產生器的碰撞規則也只擺
// 90 度的倍數。認不得的角度由 `scripts/validate_data.py` 在建置前擋下，訊息裡帶著 id。
//
// 用查表而不是三角函數，是因為 Math.sin(Math.PI) 不是 0，而那個 1.2e-16 會變成 DOM 裡
// 一串 356.00000000000006。
const BACK_DIRECTION: Record<number, PlanPoint> = {
  0: { x: 0, y: -1 },
  90: { x: -1, y: 0 },
  180: { x: 0, y: 1 },
  270: { x: 1, y: 0 },
};

export function fixtureFrame(geometry: PlanRect, rotation: number): FixtureFrame {
  // 擋不住的時候退回 0（背面朝上）而不是四捨五入到最近的 90 度：**四捨五入會把 45 度
  // 畫成 90 度，看起來像一個正常的朝向，只是錯的**；退回 0 至少是一個固定、看得出來
  // 「這件傢俱沒轉」的結果。真正的守門人是建置前的驗證。
  const back = BACK_DIRECTION[rotation] ?? BACK_DIRECTION[0];
  const front = { x: -back.x, y: -back.y };
  const lateral = { x: -back.y, y: back.x };

  const cx = geometry.x + geometry.width / 2;
  const cy = geometry.y + geometry.height / 2;
  const depth = Math.abs(front.x) * geometry.width + Math.abs(front.y) * geometry.height;
  const span = Math.abs(lateral.x) * geometry.width + Math.abs(lateral.y) * geometry.height;

  const at = (u: number, v: number): PlanPoint => ({
    x: cx + front.x * (u - 0.5) * depth + lateral.x * (v - 0.5) * span,
    y: cy + front.y * (u - 0.5) * depth + lateral.y * (v - 0.5) * span,
  });

  return {
    at,
    depth,
    span,
    front,
    radii: (s, d) => (lateral.x !== 0 ? { rx: s, ry: d } : { rx: d, ry: s }),
    rect(u0, v0, u1, v1) {
      const a = at(u0, v0);
      const b = at(u1, v1);
      return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
      };
    },
  };
}
