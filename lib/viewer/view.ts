import type { ViewBox } from "@/lib/floorplan/types";

// 圖面座標（cm）↔ 畫面座標（CSS px）的換算層。
//
// 這一層是檢視器最會壞的地方，已經壞過兩次：PRD v0.5 把容錯半徑寫成「46 SVG 單位」
// （= 46cm，全圖下只有 14px，比手指還小），原型則在放大後重算容錯圈、畫出只剩三分之一的圈。
// 兩次都不是狀態機錯，是換算錯。所以換算集中在這裡，別處不得自己乘除。
//
// 縮放與平移走 CSS transform，不是每幀重設 SVG 的 viewBox（PRD §9 效能要求）：
// viewBox 固定是整張圖，畫布用 transform 推來推去，瀏覽器才走得到合成器。

/** 視野：圖面上哪個點在畫面正中央、放大幾倍。zoom 1 = 整張圖剛好放得下。 */
export type View = { cx: number; cy: number; zoom: number };

/**
 * 換算一個點所需要的全部東西。三者必須來自同一個時刻——拿舊的視野配新量到的寬度，
 * 算出來的座標會安靜地偏掉，而畫面上看不出來。綁成一個值就沒有配錯的機會。
 */
export type Projection = {
  viewBox: ViewBox;
  /** 可視區域的寬度（CSS px）。它就是 px ↔ cm 的比例尺。 */
  viewportWidth: number;
  view: View;
};

/**
 * 可視區域的高度由寬度與 viewBox 的長寬比推出來，不另外量。
 * 量兩次會得到兩個互相矛盾的數字，而「zoom 1 剛好放得下整張圖」這件事就不再成立。
 */
function viewportHeight({ viewBox, viewportWidth }: Projection): number {
  return (viewportWidth * viewBox.height) / viewBox.width;
}

/** 當前縮放下 1cm 畫成幾個 CSS px。 */
function pxPerCm({ viewBox, viewportWidth, view }: Projection): number {
  return (viewportWidth / viewBox.width) * view.zoom;
}

/**
 * 螢幕像素 → 圖面公分。
 * 容錯半徑一律以 CSS px 定義（手指的大小不隨縮放改變），判定時用這個換回 cm。
 */
export function pxToCm(projection: Projection, px: number): number {
  return px / pxPerCm(projection);
}

/** 整張圖剛好放得下的視野。 */
export function fitView(viewBox: ViewBox): View {
  return {
    cx: viewBox.x + viewBox.width / 2,
    cy: viewBox.y + viewBox.height / 2,
    zoom: 1,
  };
}

/** 把視野的中心拉回來，讓可視範圍不會跑出圖外（圖邊之外沒有東西可看）。 */
export function clampView(viewBox: ViewBox, view: View): View {
  const visibleW = viewBox.width / view.zoom;
  const visibleH = viewBox.height / view.zoom;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
  return {
    zoom: view.zoom,
    cx: clamp(view.cx, viewBox.x + visibleW / 2, viewBox.x + viewBox.width - visibleW / 2),
    cy: clamp(view.cy, viewBox.y + visibleH / 2, viewBox.y + viewBox.height - visibleH / 2),
  };
}

/**
 * 畫布左上角要被推到哪裡（CSS px）。transform 與反算共用這一份，
 * 兩邊各寫一次的話，改了其中一邊畫面就會跟命中判定對不起來。
 */
function originOffset(projection: Projection) {
  const { viewBox, viewportWidth, view } = projection;
  const scale = pxPerCm(projection);
  return {
    scale,
    tx: viewportWidth / 2 - (view.cx - viewBox.x) * scale,
    ty: viewportHeight(projection) / 2 - (view.cy - viewBox.y) * scale,
  };
}

/**
 * 畫布的 CSS transform。畫布是一個 viewportWidth 寬、依 viewBox 長寬比等比的 <svg>，
 * transform-origin 在左上角，所以位移量就是「把視野中心那一點推到可視區域正中央」。
 */
export function canvasTransform(projection: Projection): string {
  const { tx, ty } = originOffset(projection);
  return `translate(${tx}px, ${ty}px) scale(${projection.view.zoom})`;
}

/** 畫面上的一點（相對於可視區域左上角的 CSS px）→ 圖面座標（cm）。 */
export function screenToPlan(
  projection: Projection,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const { scale, tx, ty } = originOffset(projection);
  return {
    x: projection.viewBox.x + (offsetX - tx) / scale,
    y: projection.viewBox.y + (offsetY - ty) / scale,
  };
}
