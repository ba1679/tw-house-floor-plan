import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SourceTierPanel } from "@/components/SourceTierPanel";
import { SymbolArt } from "@/components/SymbolArt";
import { SymbolPageAnalytics } from "@/components/SymbolPageAnalytics";
import { loadFloorPlan } from "@/lib/floorplan/data";
import { isSymbolAbsent } from "@/lib/floorplan/hotspots";
import { jsonLd, symbolDefinedTermJsonLd, symbolMetadata } from "@/lib/site-metadata";
import { loadSymbolsForPages } from "@/lib/symbols/data";
import { printedSourceRefs } from "@/lib/symbols/source-refs";
import { highlightHref } from "@/lib/viewer/highlight";
import {
  CATEGORY_LABELS,
  SECTION_LABELS,
  SYMBOL_LAYOUT_BUTTON,
  absentSymbolButton,
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

  // 每頁自己的標題、描述、canonical 與 Open Graph。query 只影響 Analytics，不進 canonical。
  return symbolMetadata(symbol);
}

export default async function SymbolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const symbols = loadSymbolsForPages();
  const symbol = symbols[id];
  if (!symbol) notFound();

  const category = CATEGORY_LABELS[symbol.category];
  const sources = printedSourceRefs(symbol.source_refs);

  return (
    <main className={styles.page}>
      <Suspense fallback={null}>
        <SymbolPageAnalytics symbolId={symbol.id} />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(symbolDefinedTermJsonLd(symbol)) }}
      />
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

        {/* 完整出處。徽章說的是「這個答案硬到什麼程度」，這一區說的是「憑什麼這樣說」——
            讀者在這裡自己數得出來我們查到幾筆，那比顯示一個內部的查證狀態欄位誠實
            （`verification_status` 不上前台，CONTEXT.md）。

            `<ol>` 而不是 `<ul>`：第一筆是主要來源，後面補的是交叉來源，順序有意思。
            每一筆印成什麼由 `printedSourceRefs` 決定，這裡只把決定畫出來——
            現況 15 筆沒有任何一筆有 `url`，M1 補上之後連結自己長出來，不必回頭改這裡。

            **這一區沒有「沒有就不出現」的豁免**，`caution` 那一區才有。零筆來源時這裡會留下
            一個空的「出處」標題——那正是該讓人看見的：一個說不出自己憑什麼的符號頁是壞的，
            不該安靜地看起來很正常。 */}
        <section className={styles.section} data-section="sources">
          <h2 className={styles.sectionLabel}>{SECTION_LABELS.sources}</h2>
          <ol className={styles.sourceList}>
            {sources.map((source) => (
              <li key={`${source.doc}|${source.locator ?? ""}`} className={styles.sourceItem}>
                <p className={styles.sourceDoc}>{source.doc}</p>
                {source.locator && <p className={styles.sourceLocator}>{source.locator}</p>}
                {source.via && <p className={styles.sourceVia}>{source.via}</p>}
                {source.link && (
                  <a className={styles.sourceLink} href={source.link.href}>
                    {source.link.label}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* 轉換點（PRD §6.2.1、M3 票 08）：把搜尋流量帶進平面圖的唯一入口。按下去，圖上這個符號的
            每一處同時亮起來——讀者剛看完的是一個圖例，這裡讓他看它長在一張真的圖上哪些地方。

            **帶去哪裡由資料決定**（`related_layouts`，編輯決定而不是統計，CONTEXT.md），不寫死
            3b2l_standard；有幾個 layout 就幾顆，今天是一顆。字照 PRD 原句、不帶格局名（理由在 `SYMBOL_LAYOUT_BUTTON`）。
            **第 2 張圖進來的那一天這裡要回頭改**：兩顆按鈕的字一模一樣，讀螢幕的人分不出哪個通往哪裡。

            **這個符號在那張圖上 0 處時，只換字**（樑，M3 票 09）：誠實說看不到，網址與畫法都不變——
            「圖上找不到」本身就是內容，進去之後由檢視器的橫幅說明為什麼。在不在圖上直接數那張圖的 hotspots，
            與檢視器決定要不要出橫幅是同一個判斷（`isSymbolAbsent`）。 */}
        <div className={styles.layoutLinks}>
          {symbol.related_layouts.map((layoutId) => {
            const floorplan = loadFloorPlan(layoutId);
            const absent = isSymbolAbsent(floorplan.hotspots, symbol.id);
            return (
              <Link key={layoutId} className={styles.layoutLink} href={highlightHref(layoutId, symbol.id)}>
                {absent ? absentSymbolButton(floorplan.name, symbol.name) : SYMBOL_LAYOUT_BUTTON}
                {/* 箭頭是給看得見的人的方向感；讀螢幕的人聽到那一句就夠了（同首頁那顆）。 */}
                <span aria-hidden="true">→</span>
              </Link>
            );
          })}
        </div>
      </article>
    </main>
  );
}
