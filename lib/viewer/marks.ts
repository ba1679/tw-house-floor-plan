import { planToScreen, pxToCm, type Projection } from "./view";

// 熱區 State 與圖上記號的**幾何**（DESIGN.md「熱區」；值在 design/_tokens.txt）。
//
// 記號的尺寸是螢幕 px：勾 20px、角標臂長 9px、焦點環離邊 3px——眼睛看得到的大小不隨縮放改變。
// 圖面卻是公分，而全圖時 1cm 只有約 0.26px。把 px 的數字直接當公分畫，勾在全圖時只剩一個 5px 的點，
// 角標與焦點環貼著熱區擠成一團。所以這裡每一個尺寸都先用 `pxToCm` 換回公分再畫。
//
// 線寬不在這裡：它是 CSS 的 non-scaling stroke，本來就是螢幕 px（`FloorPlanViewer.module.css`）。
// 但**線畫在熱區外側**，路徑的偏移量是線寬的一半，所以兩邊的數字必須一致——`tests/design-language.spec.ts` 守著。

export const MARK_PX = {
  /** `--state-selected-width` */
  selectedWidth: 3,
  /** `--state-selected-mark`：白襯邊，接在線的外側。 */
  selectedCasing: 1.5,
  /** `--state-revealed-width` */
  revealedWidth: 3,
  /** 角標離熱區邊緣的距離。 */
  revealedGap: 3,
  /** `--state-revealed-mark`：四角 L 形的臂長。 */
  revealedArm: 9,
  /** 鍵盤焦點環離熱區邊緣的距離，讓開 selected 的線與白襯邊。 */
  focusGap: 3,
  /** `--focus-ring-light-width`：白 2px／黑 2px／白 2px 疊出來的總寬。 */
  focusWidth: 6,
  /** `--mark-check-size` */
  checkSize: 20,
  /** `--mark-check-width` */
  checkWidth: 4,
  /** `--mark-check-casing`：兩側各一道白襯邊。 */
  checkCasing: 2.5,
} as const;

/** 20px 見方裡的一個勾（相對於中心）：短邊往右下到轉折點，長邊往右上。 */
const CHECK_POINTS = [
  [-9, 0],
  [-3.5, 6.5],
  [9, -8],
] as const;
const CHECK_ELBOW = CHECK_POINTS[1];

type Rect = readonly [number, number, number, number];

/** 熱區往外擴 `outset` 公分的矩形框。 */
function framePath([x, y, width, height]: Rect, outset: number): string {
  const left = x - outset;
  const top = y - outset;
  const right = x + width + outset;
  const bottom = y + height + outset;
  return `M ${left} ${top} H ${right} V ${bottom} H ${left} Z`;
}

/**
 * `selected` 的線與白襯邊。線的內緣貼著熱區邊緣：熱區裡就是要學的符號，窗的熱區全圖時只有 6.9px 高，
 * 線壓在邊上會蓋掉一半。白襯邊畫在線底下、寬度多一截，露出來的就是線外側那一圈。
 */
export function selectedFrame(rect: Rect, projection: Projection) {
  const cm = pxToCm(projection, 1);
  const { selectedWidth, selectedCasing } = MARK_PX;
  return {
    line: framePath(rect, (selectedWidth / 2) * cm),
    casing: framePath(rect, ((selectedWidth + selectedCasing) / 2) * cm),
  };
}

/**
 * `revealed` 的四角 L 形角標。臂長 9px；邊太短時**該邊的臂**縮到那一邊的一半，
 * 細長的窗才不會四個角連成一整圈、看起來像 `selected` 的框。
 */
export function revealedCorners([x, y, width, height]: Rect, projection: Projection): string {
  const cm = pxToCm(projection, 1);
  const { revealedGap, revealedWidth, revealedArm } = MARK_PX;
  const outset = (revealedGap + revealedWidth / 2) * cm;
  const left = x - outset;
  const top = y - outset;
  const right = x + width + outset;
  const bottom = y + height + outset;
  const armX = Math.min(revealedArm * cm, (right - left) / 2);
  const armY = Math.min(revealedArm * cm, (bottom - top) / 2);
  return [
    `M ${left + armX} ${top} H ${left} V ${top + armY}`,
    `M ${right - armX} ${top} H ${right} V ${top + armY}`,
    `M ${left + armX} ${bottom} H ${left} V ${bottom - armY}`,
    `M ${right - armX} ${bottom} H ${right} V ${bottom - armY}`,
  ].join(" ");
}

/** 鍵盤焦點環的中心線：離熱區邊緣 3px 起畫、6px 寬，中心就在 6px 外。 */
export function focusRing(rect: Rect, projection: Projection): string {
  const { focusGap, focusWidth } = MARK_PX;
  return framePath(rect, (focusGap + focusWidth / 2) * pxToCm(projection, 1));
}

/**
 * 找找看答對的勾：轉折點對著熱區的右上角，整個勾（連白襯邊）在鍵盤焦點環外面（DESIGN.md「找找看答對的勾」）。
 * 勾要讀得出標的是哪一個——窗排得密，離角落遠一點就像在標隔壁那扇。
 *
 * 右上角那個位置會被圖框切掉時換到左上角，上方放不下時換到熱區下方：勾是答對唯一的形狀訊號，只露一半等於沒有。
 */
export function checkMark([x, y, width, height]: Rect, projection: Projection): string {
  const cm = pxToCm(projection, 1);
  const { checkSize, checkWidth, checkCasing, focusGap, focusWidth } = MARK_PX;
  const scale = checkSize / 20;
  const points = CHECK_POINTS.map(([px, py]) => [px * scale, py * scale] as const);
  // 勾連同線寬與白襯邊（圓頭，四面多出一樣的一截），從中心往四邊各到哪裡。螢幕 px。
  const stroke = checkWidth / 2 + checkCasing;
  const reachRight = Math.max(...points.map(([px]) => px)) + stroke;
  const reachUp = -Math.min(...points.map(([, py]) => py)) + stroke;
  const reachDown = Math.max(...points.map(([, py]) => py)) + stroke;
  const ring = focusGap + focusWidth;
  const elbowX = CHECK_ELBOW[0] * scale;

  // 中心點的候選位置：px 的偏移乘上 cm 換成圖面座標。
  const atRight = x + width - elbowX * cm;
  const atLeft = x - elbowX * cm;
  const above = y - (ring + reachDown) * cm;
  const below = y + height + (ring + reachUp) * cm;

  const fitsRight = planToScreen(projection, atRight, above).x + reachRight <= projection.viewportWidth;
  const cx = fitsRight ? atRight : atLeft;
  const fitsAbove = planToScreen(projection, cx, above).y - reachUp >= 0;
  const cy = fitsAbove ? above : below;

  const [first, ...rest] = points.map(([px, py]) => `${cx + px * cm} ${cy + py * cm}`);
  return `M ${first} ${rest.map((p) => `L ${p}`).join(" ")}`;
}
