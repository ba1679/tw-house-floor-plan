import type { MetadataRoute } from "next";
import { listLayoutIds } from "@/lib/floorplan/data";
import { SITE_URL } from "@/lib/site-url";
import { loadCategories, loadSymbolsForPages } from "@/lib/symbols/data";

// 給搜尋引擎的全站頁面清單（spec user story 32、票 10）：它不必靠自己爬連結猜這個網站有哪些頁。
//
// **id 沒有自己的名單。** 每一種頁有哪幾張，問的是那些頁面的 `generateStaticParams` 問的同一批函式——
// 平面圖頁 `listLayoutIds()`、符號頁 `loadSymbolsForPages()`、分類頁 `loadCategories()`。加一個符號、
// 一類、一張圖，sitemap 自己變長；頁面不產生的網址（`plumbing_electric` 這種沒有符號的分類）這裡也列不出來。
// 在這裡另外抄一份 id，就是 PRD §9「不得各自維護副本」要防的第二份名單。
//
// **有哪幾種頁則是這裡列的**：首頁、平面圖、符號、分類、導讀，網址前綴也在這裡再寫一次（各頁的連結同樣各自寫，
// 站上沒有共用的路由表）。多一種頁面時要回頭加一行；忘了加，`tests/sitemap.spec.ts` 拿 `out/` 真的產出的頁來對，會紅。
//
// 先後照 PRD §8 的資訊架構：首頁、平面圖、符號頁、分類頁。
//
// **只給 `url`。**`lastModified` 要準才有用，而資料裡沒有一個說得準「這一頁上次改了什麼」的欄位
// （`verified_at` 是查證日，不是頁面改動日）；`changeFrequency` 與 `priority` Google 不看。

// sitemap 在 Next 裡是一個 route handler，`output: "export"` 之下沒有明講是靜態的，build 會直接拒絕它。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    ...listLayoutIds().map((id) => `/layouts/${id}`),
    ...Object.keys(loadSymbolsForPages()).map((id) => `/symbols/${id}`),
    ...loadCategories().map((category) => `/categories/${category.id}`),
    "/guides/furniture-dimensions",
  ];
  // `SITE_URL` 不是合法網址的話 `new URL` 直接丟錯，build 跟著斷——比印出一份壞的 sitemap 好。
  return paths.map((path) => ({ url: new URL(path, SITE_URL).href }));
}
