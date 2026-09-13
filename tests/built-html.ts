import { readFileSync } from "node:fs";

// 讀 `out/` 建置產物的測試共用的幾個小工具：問的是「靜態 HTML 裡帶了什麼出去」（spec user story 33）。
//
// 只收**各份 spec 寫法一字不差**的東西。`textOf` 刻意不在這裡：site-footer.spec.ts 與
// category-page.spec.ts 那兩份還原的東西不同（前者只剝標籤，後者連 HTML entity 一起還原），理由各寫在各自那裡。

/** 一頁的 `<title>`，取第一個：頁首那一個排在最前面，後面的可能是嵌進來的 SVG 自己的 `<title>`。 */
export const titleOf = (html: string) => /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1];

export const descriptionOf = (html: string) =>
  /<meta name="description" content="([^"]*)"/.exec(html)?.[1];

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
