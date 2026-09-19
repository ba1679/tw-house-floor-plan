import { spriteArt } from "@/lib/symbols/sprite";
import { symbolArtLabel } from "@/lib/ui/copy";
import styles from "./SymbolArt.module.css";

// 一個符號畫出來長什麼樣，取自 `data/symbols.sprite.svg`。
//
// **這不是圖示（icon），是平面圖的放大局部**：線型、填色、記號與圖面上那一套是同一套，
// 所以使用者在這裡認得的形狀，回到平面圖上找得到（PRD §12）。也因此**不另外畫一套**——
// 另外畫的那一套遲早會與圖面分岔，而分岔的那一天畫面上看不出來。
//
// 顏色由 sprite 自己的 `var(--fp-*)` 決定，這裡不覆寫：主圖讀的是同一組 `--fp-*`，
// 值只在 `app/globals.css` 定義一次；sprite 裡的 fallback 與它同值（`tests/design-language.spec.ts` 守著）。

export function SymbolArt({ svgRef, name }: { svgRef: string; name: string }) {
  const art = spriteArt(svgRef);

  return (
    <svg
      className={styles.art}
      viewBox={art.viewBox}
      // 替代文字取自**資料裡的 name**，不是 sprite 自己的 <title>：名字是內容，
      // 內容維護者改一次資料就該全站跟著改。sprite 的 <title> 留著不動，
      // 它是那一格圖形對其他消費者的名字。
      role="img"
      aria-label={symbolArtLabel(name)}
      dangerouslySetInnerHTML={{ __html: art.markup }}
    />
  );
}
