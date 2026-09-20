import { readFileSync, readdirSync } from "node:fs";

// 讀 `out/` 建置產物的測試共用的幾個小工具：問的是「靜態 HTML 裡帶了什麼出去」（spec user story 33）。
//
// 只收**各份 spec 寫法一字不差**的東西。`textOf` 刻意不在這裡：site-footer.spec.ts 與
// category-page.spec.ts 那兩份還原的東西不同（前者只剝標籤，後者連 HTML entity 一起還原），理由各寫在各自那裡。

/** 一頁的 `<title>`，取第一個：頁首那一個排在最前面，後面的可能是嵌進來的 SVG 自己的 `<title>`。 */
export const titleOf = (html: string) => /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1];

export const descriptionOf = (html: string) =>
  /<meta name="description" content="([^"]*)"/.exec(html)?.[1];

/**
 * 這一頁自己宣告了不給搜尋引擎收（`<meta name="robots" content="noindex">`）。
 * 看的是頁面自己的宣告，不是一份「哪些路徑不算」的名單：名單明天多一種 noindex 頁時不會跟著變。
 */
export const isNoindex = (html: string) =>
  /<meta name="robots" content="[^"]*\bnoindex\b/.test(html);

/**
 * 一頁**沒有宣告自己的標題與描述時**拿到的是什麼——看 404 頁：它由根版面產出，沒有自己的 metadata。
 * 從建置產物讀，不從 `app/layout.tsx` 抄：根版面哪天換了字，問「有沒有沿用它」的測試不必跟著改。
 *
 * 404 頁上有**兩個** `<title>`：根版面那一句，以及 Next 自己印的「404: This page could not be found.」。
 * 先後由 Next 決定，所以兩個都收，不賭哪一個在前——取第一個的話，Next 哪天換了順序，
 * 「不是根版面那一句」就成了永遠是綠的斷言。
 */
export function rootLayoutFallback() {
  const html = readFileSync("out/404.html", "utf8");
  return {
    titles: [...html.matchAll(/<title[^>]*>([^<]*)<\/title>/g)].map((match) => match[1]),
    description: descriptionOf(html),
  };
}

/**
 * `public/` 原樣複製進 `out/` 的檔案（Search Console 的驗證檔 `googleXXXX.html` 之類），相對 `out/` 的路徑。
 * 它們是靜態檔，不是站上的頁面——沒有標題、沒有頁尾，也不該列在 sitemap 上。
 */
const publicAssets = new Set(readdirSync("public", { recursive: true, encoding: "utf8" }));

export const isPublicAsset = (pathInOut: string) => publicAssets.has(pathInOut);

/**
 * `out/` 裡每一張有自己內容的頁，相對 `out/` 的路徑（`index.html`、`symbols/wall.html`⋯）。
 *
 * 掃 `out/` 而不列舉路由：列舉的清單明天多一頁時不會紅，只會少測一頁（理由同 site-footer.spec.ts）。
 * 404 與 `_not-found` 不算——它們是根版面的後備頁，沒有自己的標題，也不是讓人從搜尋結果點進來的頁。
 * site-footer.spec.ts 自己那一份掃描**連 404 一起算**（免責聲明落在哪一頁都要有），所以它不用這個。
 */
export const contentPages = () =>
  readdirSync("out", { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".html"))
    .filter((path) => !["404.html", "_not-found.html"].includes(path))
    .filter((path) => !isPublicAsset(path));
