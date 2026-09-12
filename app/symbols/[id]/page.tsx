import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceTierPanel } from "@/components/SourceTierPanel";
import { SymbolArt } from "@/components/SymbolArt";
import { loadSymbolsForPages } from "@/lib/symbols/data";
import {
  CATEGORY_LABELS,
  SECTION_LABELS,
  confusedWithLabel,
  symbolPageDescription,
  symbolPageTitle,
} from "@/lib/ui/copy";
import styles from "./page.module.css";

// 符號頁是這個網站的**主要入站點**：大多數人是從 Google 搜「平面圖上的虛線是什麼」
// 點進來的，他沒看過首頁，也不會往上找導覽（PRD §6.2.1）。所以這一頁要自己站得住：
// 標題就是他剛才打的那句話，答案在第一屏，而且說得出這個答案憑什麼。
//
// **欄位順序與說明卡刻意不同。** 說明卡是站在接待中心、手上有圖的時候看的；
// 這一頁是搜尋落地頁，讀者手上還沒有圖。所以「容易搞混」排在「注意事項」之前——
// 「柱跟牆怎麼分」正是人們會打進 Google 的字，而 `caution` 14 筆裡只有一筆有，
// 照 PRD 的欄位順序排會把最貼近搜尋意圖的東西埋在一個大多數頁面都空著的區塊後面。

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(loadSymbolsForPages()).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const symbol = loadSymbolsForPages()[(await params).id];
  if (!symbol) return {};

  // 每頁自己的標題與描述。14 頁共用根版面那一句「平面圖教學」的話，
  // 搜尋引擎會把它們當成同一頁。
  return {
    title: symbolPageTitle(symbol.name),
    description: symbolPageDescription(symbol.plain_meaning),
  };
}

export default async function SymbolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const symbols = loadSymbolsForPages();
  const symbol = symbols[id];
  if (!symbol) notFound();

  const category = CATEGORY_LABELS[symbol.category];

  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <p className={styles.category}>
          {category.zh} / {category.en}
        </p>
        {/* `<title>` 與 `<h1>` 同一句：搜尋結果上那一行與落地後看到的第一行不該是兩句話。 */}
        <h1 className={styles.title}>{symbolPageTitle(symbol.name)}</h1>

        <SourceTierPanel tier={symbol.source_tier} />

        <figure className={styles.figure}>
          <SymbolArt svgRef={symbol.svg_ref} name={symbol.name} />
        </figure>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>{SECTION_LABELS.plainMeaning}</h2>
          <p className={styles.prose}>{symbol.plain_meaning}</p>
        </section>

        {/* 每一則都連得到對方的符號頁：認錯符號的人是成對出現的，而他此刻正在讀的
            這一則，講的就是對面那一個。連結的字帶著對方的名字，搜尋引擎也讀得懂。 */}
        {symbol.confused_with.length > 0 && (
          <section className={styles.section} data-section="confused-with">
            <h2 className={styles.sectionLabel}>{SECTION_LABELS.confusedWith}</h2>
            <dl className={styles.confusedList}>
              {symbol.confused_with.map((other) => (
                <div key={other.symbol_id} className={styles.confusedItem}>
                  <dt className={styles.confusedName}>
                    <Link className={styles.confusedLink} href={`/symbols/${other.symbol_id}`}>
                      {confusedWithLabel(symbols[other.symbol_id]?.name ?? other.symbol_id)}
                    </Link>
                  </dt>
                  <dd className={styles.confusedText}>{other.difference}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* caution 為 null 時整區不出現，不留標題也不留空白——14 筆裡只有雨遮有，
            留一個空標題會讓另外 13 頁看起來像壞掉。 */}
        {symbol.caution && (
          <section className={styles.section} data-section="caution">
            <h2 className={styles.sectionLabel}>{SECTION_LABELS.caution}</h2>
            <p className={styles.prose}>{symbol.caution}</p>
          </section>
        )}
      </article>
    </main>
  );
}
