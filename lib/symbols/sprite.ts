import { readFileSync } from "node:fs";
import { join } from "node:path";

// `data/symbols.sprite.svg` 是「符號畫成什麼樣」的唯一來源：它畫的線型、填色、記號
// 與圖面上那一套是同一套，所以符號頁用它就自動兌現本站的核心承諾——
// 符號頁上認得的形狀，回到平面圖上找得到（PRD §12、docs/adr/0005）。
//
// **把那一段 SVG 內嵌進頁面，不用 `<use href="sprite.svg#id">`。** 外部 `<use>` 在
// Chrome／Safari 不會載入（sprite 檔頭就寫著這件事），而「靜默留白」在一張 SEO 落地頁上
// 看起來會像設計沒做完。內嵌的代價是每頁多幾百個 bytes，那是 SSG 的頁面，付得起。
//
// 用正則而不是 XML 解析器：這個 repo 沒有 XML 的依賴，而 sprite 是自家的檔案、
// 結構由 `scripts/validate_data.py` 在 build 之前顧著（每個 `<symbol>` 的 id、viewBox、
// `<title>` 都檢查過）。`<symbol>` 不會巢狀，非貪婪比對到 `</symbol>` 就是那一格。

const SPRITE_FILE = join(process.cwd(), "data", "symbols.sprite.svg");

/** sprite 裡的一格：它自己的 viewBox，與它裡面那一段原封不動的 SVG。 */
export type SpriteArt = { viewBox: string; markup: string };

/**
 * **不快取。** 與 `data.ts` 同一條規矩：資料檔改了，`next dev` 下一次請求就要看得到——
 * sprite 不是模組，dev server 不會因為它變了而重新求值，模組層的快取因此會一路撐到重啟。
 * 代價是一次建置多解析 14 次一份 12KB 的檔案，在一個只跑一次 build 的 SSG 站上可以忽略。
 */
function parseSprite(): Map<string, SpriteArt> {
  const source = readFileSync(SPRITE_FILE, "utf8");
  const art = new Map<string, SpriteArt>();

  for (const [, attrs, markup] of source.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const id = attribute(attrs, "id");
    const viewBox = attribute(attrs, "viewBox");
    if (id && viewBox) art.set(id, { viewBox, markup: markup.trim() });
  }
  return art;
}

const attribute = (attrs: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1];

/**
 * 一個 `svg_ref` 畫的是什麼。
 *
 * 找不到就**中斷建置**：驗證器已經把這件事擋在前面（`svg_ref` 必須存在於 sprite），
 * 所以走到這裡代表那條檢查被繞過了，而靜默留白比建置失敗難查得多。
 */
export function spriteArt(svgRef: string): SpriteArt {
  const art = parseSprite().get(svgRef);
  if (!art) {
    throw new Error(
      `${SPRITE_FILE} 裡找不到 <symbol id="${svgRef}">——` +
        `符號頁的圖形取自 sprite，缺了這一格頁面上就是一塊空白。` +
        `scripts/validate_data.py 應該先擋下這件事，它沒擋下就是那條檢查也壞了`,
    );
  }
  return art;
}
