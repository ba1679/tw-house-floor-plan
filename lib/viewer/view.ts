import type { PlanRect, ViewBox } from "@/lib/floorplan/types";

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
 * 換算一個點所需要的全部東西。四者必須來自同一個時刻——拿舊的視野配新量到的寬度，
 * 算出來的座標會安靜地偏掉，而畫面上看不出來。綁成一個值就沒有配錯的機會。
 */
export type Projection = {
  viewBox: ViewBox;
  /** 可視區域的寬度（CSS px）。它就是 px ↔ cm 的比例尺。 */
  viewportWidth: number;
  /**
   * 可視區域的高度（CSS px）。說明卡升起來時它會變小——卡片是版面裡的一格，
   * 圖被擠進卡片上方那條可視帶（票 03 決議 3）。
   *
   * 這個數字與 viewportWidth 來自**同一個框的同一次觀測**（一個 ResizeObserver entry），
   * 不是另外量的第二份。票 02 那條「量兩次會得到兩個互相矛盾的數字」的顧慮講的正是
   * 「一邊由寬度乘長寬比推出高度、一邊又去 getBoundingClientRect 量高度」；
   * 現在高度由版面決定、只有一個來源，顧慮不再成立。
   */
  viewportHeight: number;
  view: View;
};

/** 框（不含視野）。fit 只跟框有關，跟現在看著哪裡無關。 */
type Frame = Omit<Projection, "view">;

/** 圖面在 zoom 1 下畫出來有多高（CSS px）。zoom 1 的定義是「寬度剛好放得下」。 */
function naturalHeight({ viewBox, viewportWidth }: Frame): number {
  return (viewportWidth * viewBox.height) / viewBox.width;
}

/**
 * 整張圖剛好塞進當前框的倍率。
 * 框比圖矮時（說明卡升起來）小於 1；框夠高時就是 1——放大到超過寬度沒有意義。
 */
export function fitZoom(frame: Frame): number {
  return Math.min(1, frame.viewportHeight / naturalHeight(frame));
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

/** 整張圖剛好放得下的視野：中心對中心，倍率取當前框放得下的最大值。 */
export function fitView(frame: Frame): View {
  const { viewBox } = frame;
  return {
    cx: viewBox.x + viewBox.width / 2,
    cy: viewBox.y + viewBox.height / 2,
    zoom: fitZoom(frame),
  };
}

/**
 * 把視野的中心拉回來，讓可視範圍不會跑出圖外（圖邊之外沒有東西可看）。
 * 可視範圍比圖還大時（zoom < 1，說明卡升起來的那條可視帶）沒有東西需要夾——
 * 這時要的是置中，不是貼邊。少了這一條，圖會在卡片升起的瞬間往左上角偏過去。
 *
 * 可視範圍的兩個邊長各自由**框自己的邊長**換算而來，不是拿 viewBox 的長寬比推出高度。
 * 框的長寬比與 viewBox 一致時兩者算出來一樣（`.viewport` 的 aspect-ratio 就是這麼定的），
 * 說明卡把框壓扁之後就不一樣了（`docs/adr/0003`）——而那正是使用者一邊看卡片一邊平移的時候：
 * 用長寬比推出來的高度會在那一刻既擋住圖的下緣、又允許畫面滑出圖外。
 */
export function clampView(frame: Frame, view: View): View {
  const scale = pxPerCm({ ...frame, view });
  const axis = (center: number, origin: number, extent: number, visible: number) =>
    visible >= extent
      ? origin + extent / 2
      : Math.min(Math.max(center, origin + visible / 2), origin + extent - visible / 2);
  return {
    zoom: view.zoom,
    cx: axis(view.cx, frame.viewBox.x, frame.viewBox.width, frame.viewportWidth / scale),
    cy: axis(view.cy, frame.viewBox.y, frame.viewBox.height, frame.viewportHeight / scale),
  };
}

/**
 * 使用者自己發起的平移：手指往哪邊走，圖就往哪邊走，位移 1:1。
 * dx/dy 是螢幕上的位移（CSS px），視野的中心因此往反方向移動同樣多的圖面公分。
 */
export function panView(projection: Projection, dx: number, dy: number): View {
  const { view } = projection;
  return {
    ...view,
    cx: view.cx - pxToCm(projection, dx),
    cy: view.cy - pxToCm(projection, dy),
  };
}

/**
 * 縮放到指定倍率，並讓畫面上 (anchorX, anchorY) 那一點底下的圖面座標留在原地。
 * 雙指的中點、雙擊的落點都是這個錨點——少了它，圖會在手指底下滑走。
 *
 * 倍率是**夾好上下限之後**才傳進來的，不是在這裡乘出來：先算後夾的話，錨點是照那個
 * 沒被夾的倍率算的，圖會在撞到上限之後繼續漂，而畫面上看起來就是「捏到底了它還在動」。
 */
export function zoomView(
  projection: Projection,
  zoom: number,
  anchorX: number,
  anchorY: number,
): View {
  const anchor = screenToPlan(projection, anchorX, anchorY);
  const factor = zoom / projection.view.zoom;
  return {
    zoom,
    cx: anchor.x + (projection.view.cx - anchor.x) / factor,
    cy: anchor.y + (projection.view.cy - anchor.y) / factor,
  };
}

/**
 * 把圖面上的一塊帶進可視範圍。看得見就原地不動，看不見就以**最小的位移**把它推進來。
 *
 * 鍵盤的焦點走到畫面外的熱區時用它（票 06）。最小位移而不是一律置中：Tab 一次就把整張圖
 * 甩到另一個位置，使用者會失去「我剛剛在哪一間」；推進來剛好看得見，旁邊的東西還在旁邊。
 *
 * **倍率不動**。鍵盤路徑不走兩段式，焦點移動不該改變使用者看圖的比例尺——
 * 那是他自己用手勢調出來的（票 04）。
 */
export function revealView(projection: Projection, rect: PlanRect, marginPx: number): View {
  const scale = pxPerCm(projection);
  const margin = marginPx / scale;
  const { view } = projection;
  const axis = (center: number, min: number, max: number, visible: number) =>
    // 比可視範圍還大的東西推不進來（放大之後的雨遮就是），這時置中——看得到中間那一段，
    // 總比貼著一邊、另一邊不知道還有多長要好。
    max - min + margin * 2 >= visible
      ? (min + max) / 2
      : Math.min(Math.max(center, max + margin - visible / 2), min - margin + visible / 2);
  return {
    zoom: view.zoom,
    cx: axis(view.cx, rect.x, rect.x + rect.width, projection.viewportWidth / scale),
    cy: axis(view.cy, rect.y, rect.y + rect.height, projection.viewportHeight / scale),
  };
}

/**
 * 現在看到的就是全圖嗎。「回到全圖」那顆按鈕要不要佔版面看這個——
 * 已經是全圖時它沒有事情可做，而它一出現就從平面圖那條可視帶挖走 56px。
 *
 * 比較留了容差：縮放經過 RESIZE 的等比調整往返之後會留下浮點數的尾數，
 * 而這個判斷只用來決定一顆按鈕的去留，差 0.1% 與 0.5cm 都不是使用者看得出來的事。
 */
export function isFitView(projection: Projection): boolean {
  const fit = fitView(projection);
  const { view } = projection;
  return (
    Math.abs(view.zoom - fit.zoom) <= fit.zoom * 1e-3 &&
    Math.abs(view.cx - fit.cx) <= 0.5 &&
    Math.abs(view.cy - fit.cy) <= 0.5
  );
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
    ty: projection.viewportHeight / 2 - (view.cy - viewBox.y) * scale,
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
