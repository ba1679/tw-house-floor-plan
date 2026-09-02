import type { FloorPlanArtwork, ViewBox } from "./types";

// 圖面由 floorplan-generator 的 render_svg.py 從同一份 floorplan 資料畫出來，產物 commit 在
// data/layouts/*.svg。這裡讀那個產物，不在 TS 裡重寫一次渲染——理由與 validate_data.py 維持
// Python 相同：一張圖兩個畫法遲早會分岔，而 PRD §12 已經有一筆 sprite 與 render_svg.py
// 畫法不一致的帳了。產物與資料是否還同步，由 scripts/validate_data.py 在 build 時把關。

const SVG_OPEN_TAG = /<svg\b([^>]*)>/;
const VIEW_BOX_ATTR = /\bviewBox="([^"]+)"/;
// 這個 id 是產生器的輸出約定（`render_svg.py` 的 hotspots 群組）。產生器改了名字，
// 這裡會靜靜地不再剝除——那時 DOM 裡會出現兩組同名的 id，而畫面上看不出來。
const HOTSPOT_GROUP = /<g id="hotspots"[\s\S]*?<\/g>\s*/;

function fail(message: string): never {
  throw new Error(
    `${message}\n` +
      "data/layouts/*.svg 是 floorplan-generator 的產物，網站直接顯示它；" +
      "格式對不上時寧可讓 build 停下來，也不要送一張畫不出來的圖上線。",
  );
}

function parseViewBox(raw: string): ViewBox {
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    fail(`viewBox 不是四個數字：${raw}`);
  }
  const [x, y, width, height] = parts as [number, number, number, number];
  return { x, y, width, height };
}

/**
 * 把產物 SVG 拆成「viewBox」與「畫面內容」兩件事。
 *
 * 產物裡的 `<g id="hotspots">` 會被拿掉：熱區層由檢視器依 floorplan.hotspots 自己畫
 * （才管得到 symbol_id 為 null 要略過、命中優先序、焦點狀態這些事），
 * 留著產物那一份只會讓同一組 id 在 DOM 裡出現兩次。
 */
export function parseFloorPlanArtwork(svg: string): FloorPlanArtwork {
  const openTag = SVG_OPEN_TAG.exec(svg);
  if (!openTag) fail("找不到 <svg> 標籤");

  const viewBoxAttr = VIEW_BOX_ATTR.exec(openTag[1]);
  if (!viewBoxAttr) fail("<svg> 沒有 viewBox，換算不出圖面座標");

  const close = svg.lastIndexOf("</svg>");
  if (close === -1) fail("找不到 </svg>");

  const inner = svg.slice(openTag.index + openTag[0].length, close);
  return {
    viewBox: parseViewBox(viewBoxAttr[1]),
    markup: inner.replace(HOTSPOT_GROUP, "").trim(),
  };
}
