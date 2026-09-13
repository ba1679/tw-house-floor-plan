import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SearchBox } from "@/components/SearchBox";
import { SymbolArt } from "@/components/SymbolArt";
import { loadCategories, loadSearchIndex } from "@/lib/symbols/data";
import {
  CATEGORY_LABELS,
  categoryCountLabel,
  categoryPageDescription,
  categoryPageTitle,
} from "@/lib/ui/copy";
import styles from "./page.module.css";

// 分類頁是給「想一類一類看完」的人走的那條路（spec user story 24）。它不是入站點——
// 從 Google 進來的人落在符號頁（PRD §6.2.1）——而是瀏覽的中繼站：一眼看完這一類有哪些，
// 點一個進到它自己的那一頁。所以這一頁不重講符號頁的內容，每一列只給認得出它的最少東西：
// 畫出來長什麼樣、叫什麼、一句白話。
//
// **這一頁沒有自己的名單。** 有哪幾張分類頁、每一張列哪些符號，全部由 `loadCategories()`
// 從資料算出；中文名從 `CATEGORY_LABELS` 來。在這裡手寫一份「就這 3 類」，那份名單當天
// 是對的，跟資料分岔的那一天畫面上看不出來（PRD §9「不得各自維護副本」）。

export const dynamicParams = false;

export function generateStaticParams() {
  return loadCategories().map((category) => ({ id: category.id }));
}

/**
 * 網址上的那一段對得到哪一類。
 *
 * 回傳值的 `id` 是 `SymbolCategory`，不是網址上那個 `string`，所以底下查 `CATEGORY_LABELS`
 * 不必硬轉。這件事買到什麼、沒買到什麼，寫在 `loadCategories()`（lib/symbols/data.ts）。
 */
function findCategory(id: string) {
  return loadCategories().find((category) => category.id === id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const category = findCategory((await params).id);
  if (!category) return {};

  // 每頁自己的標題與描述。三頁共用根版面那一句「平面圖教學」的話，
  // 搜尋引擎會把它們當成同一頁。
  const { zh } = CATEGORY_LABELS[category.id];
  return {
    title: categoryPageTitle(zh),
    description: categoryPageDescription(
      zh,
      category.symbols.map((symbol) => symbol.name),
    ),
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const category = findCategory((await params).id);
  if (!category) notFound();

  const label = CATEGORY_LABELS[category.id];

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <p className={styles.category}>
          {label.zh} / {label.en}
        </p>
        {/* `<title>` 與 `<h1>` 同一句：搜尋結果上那一行與落地後看到的第一行不該是兩句話。 */}
        <h1 className={styles.title}>{categoryPageTitle(label.zh)}</h1>

        {/* 搜尋框排在標題**之後**（落地後看到的第一行仍是標題），但在「共 N 個符號」與清單**之前**：
            數目是清單的前言，兩者不拆開；而想查特定符號的人不必先捲過這一類的清單才找得到它。
            它搜的是全部，不是這一類——標籤自己說（`searchLabel`）。索引見 `loadSearchIndex()`。 */}
        <div className={styles.search}>
          <SearchBox index={loadSearchIndex()} />
        </div>

        <p className={styles.count}>{categoryCountLabel(category.symbols.length)}</p>

        <ul className={styles.list}>
          {category.symbols.map((symbol) => (
            <li key={symbol.id} className={styles.item}>
              <Link className={styles.link} href={`/symbols/${symbol.id}`}>
                {/* 圖形在這裡**對讀螢幕的人藏起來**，與符號頁相反。那一頁的圖是內容——它在教
                    這個形狀——所以有替代文字；這裡整列是一個連結，替代文字會被併進連結的名字，
                    唸出來是「牆在平面圖上的畫法 牆 牆是⋯」，名字唸兩次，反而更難聽出這個連結
                    通往哪裡。看得見的人靠形狀認出他要找的那一個，讀螢幕的人靠緊接著的名字。 */}
                <span className={styles.art} aria-hidden="true">
                  <SymbolArt svgRef={symbol.svg_ref} name={symbol.name} />
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{symbol.name}</span>
                  <span className={styles.meaning}>{symbol.plain_meaning}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
