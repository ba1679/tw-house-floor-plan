import type { Hotspot, ViewBox } from "@/lib/floorplan/types";
import { clampView, fitView, fitZoom, pxToCm, type Projection, type View } from "./view";

// 兩段式點擊的狀態機：(state, action) => state，不碰 DOM、不讀 document。
//
// 這張圖 37 個熱區沒有一個滿足 44×44px 觸控規格（最大的短邊只有 34.5px），而把命中區
// 放大到 44px 在數學上走不通——柱與相鄰窗的間距只有 3cm，命中區會互相吃掉。所以改成
// 「先點大略位置 → 自動放大 3× → 再點一次確認」：第一段容錯，第二段確認。
//
// 三個常數經原型 `prototype/two-stage-tap`（commit 4f18334）在真實資料上實測，不改
// （PRD §11 #21）：全圖下第一段容錯 = 圖面 147cm 半徑，每 10cm 取樣 15,120 點的結果是
// 落空 11%、中位數 3 個候選、最壞 9 個，而最壞的 9 個放大 3× 後在畫面上明顯分離。

const TAP1_TOLERANCE_PX = 46; // 第一段：點大略位置的容錯半徑
const TAP2_TOLERANCE_PX = 30; // 第二段：確認時「最近者」的上限
const STAGE_ZOOM = 3; // 第一段之後自動放大的倍率

export type Stage = "browsing" | "candidates" | "confirmed";

export type ViewerState = {
  /** 已經濾掉 symbol_id 為 null 的熱區：它們不畫、不進候選、不計入任何統計。 */
  readonly hotspots: Hotspot[];
  readonly viewBox: ViewBox;
  viewportWidth: number;
  /** 可視區域的高度（CSS px）。說明卡是版面裡的一格，它升起來這個數字就變小。 */
  viewportHeight: number;
  stage: Stage;
  view: View;
  /** 第一段自動放大之前的視野。確認後要回到這裡，使用者才不會失去方向感。 */
  savedView: View | null;
  candidates: Hotspot[];
  selected: Hotspot | null;
  /**
   * 命中判定當下的容錯半徑（cm）。畫容錯圈時用這個，**不在放大後重算**——
   * 重算是拿 3× 的比例尺去換 46px，得到的圈只有實際的三分之一，
   * 圈外的熱區卻亮著，看起來像 bug。原型自己踩過。
   */
  tolCmAtTap: number | null;
  lastTap: { x: number; y: number } | null;
  /** 第二段點下去卻沒選中任何候選。沒有這個旗標，畫面上的字跟成功時一模一樣，
      使用者不知道剛剛那一下有沒有被聽見。 */
  confirmMissed: boolean;
  /**
   * 找找看（M4）的視野鎖定：擋使用者自己發起的縮放，**不擋 firstTap 的自動 3×**。
   * 寫成一個開關的話，找找看就變成一道不可能作答的題目。
   * M2 不接 UI，只把這個輸入留好，M4 才不必回頭改狀態機。
   */
  fitLocked: boolean;
};

export type ViewerAction =
  | { type: "TAP"; x: number; y: number }
  | { type: "RESELECT" }
  | { type: "NEXT_OCCURRENCE" }
  | { type: "RESIZE"; viewportWidth: number; viewportHeight: number };

export type ViewerConfig = {
  hotspots: Hotspot[];
  viewBox: ViewBox;
  viewportWidth: number;
  viewportHeight: number;
  fitLocked?: boolean;
};

export function createViewerState(config: ViewerConfig): ViewerState {
  return {
    hotspots: config.hotspots.filter((h) => h.symbol_id !== null),
    viewBox: config.viewBox,
    viewportWidth: config.viewportWidth,
    viewportHeight: config.viewportHeight,
    stage: "browsing",
    view: fitView(config),
    savedView: null,
    candidates: [],
    selected: null,
    tolCmAtTap: null,
    lastTap: null,
    confirmMissed: false,
    fitLocked: config.fitLocked ?? false,
  };
}

const areaCm2 = (h: Hotspot) => h.coords[2] * h.coords[3];

/** 熱區命中優先序（PRD §6.1.1）：面積小者優先，兩段都適用。 */
const bySmallestArea = (a: Hotspot, b: Hotspot) => areaCm2(a) - areaCm2(b);

function containsCm(h: Hotspot, x: number, y: number): boolean {
  const [hx, hy, w, ht] = h.coords;
  return x >= hx && x <= hx + w && y >= hy && y <= hy + ht;
}

/** 點到熱區矩形的最短距離（cm）；點在矩形內時為 0。 */
function distCm(h: Hotspot, x: number, y: number): number {
  const [hx, hy, w, ht] = h.coords;
  return Math.hypot(Math.max(hx - x, 0, x - (hx + w)), Math.max(hy - y, 0, y - (hy + ht)));
}

// ViewerState 本身就帶著 Projection 要的三個欄位，直接當 Projection 用——
// 另外拆一份出來，就多一個「拆的時候拿錯視野」的機會。
function toleranceCm(s: ViewerState, px: number): number {
  return pxToCm(s satisfies Projection, px);
}

/** 第一段：點大略位置，圈出附近的候選並放大。 */
function firstTap(s: ViewerState, x: number, y: number): ViewerState {
  const tolCm = toleranceCm(s, TAP1_TOLERANCE_PX);
  const candidates = s.hotspots.filter((h) => distCm(h, x, y) <= tolCm).sort(bySmallestArea);

  // 附近沒有東西可選：**維持縮放不變**。放大到一個沒有東西的畫面只會讓使用者迷路。
  if (candidates.length === 0) {
    return {
      ...s,
      stage: "browsing",
      candidates: [],
      selected: null,
      lastTap: { x, y },
      tolCmAtTap: tolCm,
      confirmMissed: false,
    };
  }

  return {
    ...s,
    stage: "candidates",
    candidates,
    selected: null,
    lastTap: { x, y },
    tolCmAtTap: tolCm,
    savedView: s.savedView ?? s.view,
    confirmMissed: false,
    // 找找看鎖定視野時也照樣放大：擋的是「使用者自己縮放」，不是機制本身。
    view: clampView(s.viewBox, { cx: x, cy: y, zoom: STAGE_ZOOM }),
  };
}

/**
 * 第二段：確認。落在熱區內，或 30px 內最近者；同樣面積小者優先。
 * **只掃第一段圈出的候選集**（PRD §11 #19）——放大後新進視野的熱區若也能被選中，
 * 那個高亮就是騙人的。
 */
function confirmTap(s: ViewerState, x: number, y: number): ViewerState {
  const inside = s.candidates.filter((h) => containsCm(h, x, y)).sort(bySmallestArea);
  let hit: Hotspot | undefined = inside[0];

  if (!hit) {
    const tolCm = toleranceCm(s, TAP2_TOLERANCE_PX);
    hit = s.candidates
      .map((h) => ({ h, d: distCm(h, x, y) }))
      .filter((o) => o.d <= tolCm)
      .sort((a, b) => a.d - b.d || bySmallestArea(a.h, b.h))[0]?.h;
  }

  // 還是沒點到：留在第二段，候選與放大都不動，讓使用者再試一次或按「重選」。
  if (!hit) return { ...s, lastTap: { x, y }, confirmMissed: true };

  // 候選的高亮到此為止：選擇已經做完，留著另外 8 個亮著只是雜訊——
  // 而這張圖本身就是學習對象，圖上多餘的標示會妨礙辨識符號的線條。
  return {
    ...s,
    stage: "confirmed",
    candidates: [],
    selected: hit,
    lastTap: { x, y },
    confirmMissed: false,
    view: s.savedView ?? s.view,
    savedView: null,
  };
}

export function reduceViewer(s: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case "TAP":
      // browsing 與 confirmed 都當作新的第一段：看完一張說明卡後直接點圖上別的地方
      // 就能看下一個，「重選」是明確的退出鍵，不是看下一個符號的必經步驟（PRD §11 #20）。
      return s.stage === "candidates"
        ? confirmTap(s, action.x, action.y)
        : firstTap(s, action.x, action.y);

    case "NEXT_OCCURRENCE": {
      // 「看它在圖上的其他位置」：換看同一個 symbol 的下一處，循環回第 1 處。
      // 卡片不關、視野不動、stage 維持 confirmed——按這一列是「換看一處」，
      // 不是「重新選一個符號」，畫面跳動會讓使用者失去剛建立起來的方向感。
      if (s.stage !== "confirmed" || !s.selected) return s;
      const siblings = occurrencesOf(s, s.selected.symbol_id);
      if (siblings.length < 2) return s;
      const next = siblings[(siblings.indexOf(s.selected) + 1) % siblings.length];
      return { ...s, selected: next };
    }

    case "RESELECT":
      if (s.stage === "browsing") return s;
      return {
        ...s,
        stage: "browsing",
        candidates: [],
        selected: null,
        lastTap: null,
        tolCmAtTap: null,
        confirmMissed: false,
        // 從 candidates 退回：還原第一段之前的視野。
        // 從 confirmed 退回：視野在確認時就已經還原了，savedView 是 null——
        // 這時該留在當下的視野，跳回全圖等於把使用者自己調好的縮放丟掉。
        // 說明卡收起來之後可視帶變高，圖跟著長回來——那是接在後面的 RESIZE 做的，
        // 不在這裡：這個 action 只負責「回到 browsing」，不負責版面。
        view: s.savedView ?? s.view,
        savedView: null,
      };

    case "RESIZE": {
      const widthChanged = action.viewportWidth !== s.viewportWidth;
      const heightChanged = action.viewportHeight !== s.viewportHeight;
      if (!widthChanged && !heightChanged) return s;

      const resized = {
        ...s,
        viewportWidth: action.viewportWidth,
        viewportHeight: action.viewportHeight,
      };

      // 只有高度變：這是說明卡自己升起或收起造成的（票 03 決議 3）。
      // **不能退回第一段**——退回就等於卡片一開就把自己關掉。
      // 圖改以新的可視帶等比縮小：zoom 依 fit 的變化比例調整，所以第一段的 3×
      // 在卡片開著的時候仍然是「fit 的三倍」，而不是突然變成別的倍率。
      if (!widthChanged) {
        const ratio = fitZoom(resized) / fitZoom(s);
        return {
          ...resized,
          view: clampView(s.viewBox, { ...s.view, zoom: s.view.zoom * ratio }),
          savedView: s.savedView && {
            ...s.savedView,
            zoom: s.savedView.zoom * ratio,
          },
        };
      }

      // 寬度變了，px ↔ cm 的比例尺跟著變。已經算出來的候選是用舊比例尺挑的，
      // 留著它們會讓畫面上的圈與實際命中範圍對不起來，所以退回第一段重來。
      return {
        ...resized,
        stage: "browsing",
        candidates: [],
        selected: null,
        lastTap: null,
        tolCmAtTap: null,
        confirmMissed: false,
        view: fitView(resized),
        savedView: null,
      };
    }
  }
}

/**
 * 同一個 symbol 在這張圖上的所有熱區，**依 floorplan.hotspots 的出現順序**。
 * 順序取檔案順序：floorplan 由程式產生、順序穩定，不必等票 06 的房間歸屬算出來。
 * （票 06 的鍵盤順序是「依房間、房間內依類別」，與這裡不同；等 06 落地後再評估要不要統一。）
 */
export function occurrencesOf(s: ViewerState, symbolId: string | null): Hotspot[] {
  return symbolId === null ? [] : s.hotspots.filter((h) => h.symbol_id === symbolId);
}

/**
 * 「這張圖上共 N 處 · 目前第 M 處」的 N 與 M。
 * N 由 hotspots 算出來、不得寫死；symbol_id 為 null 者在 createViewerState 就濾掉了，
 * 所以這裡不會把它們算進去（PRD §7.3）。
 */
export function selectedOccurrence(s: ViewerState): { total: number; index: number } | null {
  if (!s.selected) return null;
  const siblings = occurrencesOf(s, s.selected.symbol_id);
  return { total: siblings.length, index: siblings.indexOf(s.selected) + 1 };
}
