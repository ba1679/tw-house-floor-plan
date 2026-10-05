import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsLink } from "@/components/AnalyticsLink";
import { BrandMark } from "@/components/BrandMark";
import { FloorPlanRenderer } from "@/components/FloorPlanRenderer";
import { SearchBox } from "@/components/SearchBox";
import { ANALYTICS_EVENTS } from "@/lib/analytics";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { loadFurnitureDimensionsGuide } from "@/lib/guides/data";
import { hasQuiz } from "@/lib/quiz/questions";
import { homeMetadata, homeWebsiteJsonLd, jsonLd } from "@/lib/site-metadata";
import { loadCategories, loadSearchIndex } from "@/lib/symbols/data";
import {
  CATEGORY_LABELS,
  BRAND_PROMISE,
  HOME_BROWSE_LABEL,
  HOME_CLAIM,
  SITE_NAME,
  SITE_PURPOSE,
  homeLayoutButton,
  homeQuizButton,
} from "@/lib/ui/copy";
import styles from "./page.module.css";

export const metadata: Metadata = homeMetadata();

export default function HomePage() {
  // 格局與入口仍由同一份資料列出，不另選主打、不維護縮圖資料。
  const layouts = listLayoutIds().map(loadFloorPlan);
  const quizLayouts = layouts.filter((layout) => hasQuiz(layout.hotspots));
  const furnitureGuide = loadFurnitureDimensionsGuide();

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeWebsiteJsonLd()) }}
      />
      <div className={styles.column}>
        <header className={styles.intro}>
          <div className={styles.introHeading}>
            <h1 className={styles.title}>{HOME_CLAIM}</h1>
          </div>
          <p className={styles.lede}>
            {SITE_NAME}{SITE_PURPOSE}。<br />
            從牆、門與窗開始，慢慢讀懂每一格。
          </p>
          <aside className={styles.brand} aria-label="關於拼厝">
            <div className={styles.brandArt}>
              <BrandMark variant="full" className={styles.brandMark} width={136} height={228} />
            </div>
          </aside>
        </header>

        <div className={styles.desk}>
          <section className={styles.layouts} aria-label="可讀的格局">
            {layouts.map((layout) => (
              <article key={layout.id} className={styles.layout} aria-labelledby={`layout-title-${layout.id}`}>
                <div className={styles.layoutHeading}>
                  <h2 id={`layout-title-${layout.id}`} className={styles.layoutTitle}>{layout.name}</h2>
                  <p className={styles.layoutPrompt}>從格局開始</p>
                </div>
                {/* 與讀圖頁共用同一個 renderer；首頁只畫圖面，不掛熱區或互動狀態。 */}
                <div className={styles.preview} role="img" aria-label={`${layout.name}平面圖縮圖`}>
                  <FloorPlanRenderer floorplan={layout} />
                </div>
                <AnalyticsLink
                  className={styles.layoutButton}
                  href={`/layouts/${layout.id}`}
                  event={{
                    name: ANALYTICS_EVENTS.selectContent,
                    content_type: "home_layout",
                    item_id: layout.id,
                    origin_page_type: "home",
                  }}
                >
                  {homeLayoutButton(layout.name)}
                  <span aria-hidden="true">→</span>
                </AnalyticsLink>
              </article>
            ))}
          </section>

          <div className={styles.tools}>
            <section className={styles.guide} aria-labelledby="home-guide">
              <h2 id="home-guide" className={styles.sectionTitle}>{furnitureGuide.title}</h2>
              <p className={styles.sectionNote}>{furnitureGuide.description}</p>
              <Link className={styles.learningButton} href="/guides/furniture-dimensions">
                <span>開始學看家具與尺寸</span>
                <span aria-hidden="true">→</span>
              </Link>
            </section>

            <section className={styles.lookup} aria-labelledby="home-lookup">
              <h2 id="home-lookup" className={styles.sectionTitle}>有個符號看不懂？</h2>
              <p className={styles.sectionNote}>查名字，或從分類慢慢找。</p>
              <SearchBox index={loadSearchIndex()} surface="home" />
              <nav className={styles.browse} aria-labelledby="home-browse">
                <h3 id="home-browse" className={styles.browseLabel}>{HOME_BROWSE_LABEL}</h3>
                <ul className={styles.categories}>
                  {loadCategories().map((category) => {
                    const label = CATEGORY_LABELS[category.id];
                    return (
                      <li key={category.id} className={styles.categoryItem}>
                        {/* 聚焦搜尋而捲動時，不預抓剛進入視野的其他入口。 */}
                        <Link className={styles.categoryLink} href={`/categories/${category.id}`} prefetch={false}>
                          <span className={styles.categoryName}>{label.zh}</span>
                          <span className={styles.categoryEn} aria-hidden="true">{label.en}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </section>

            {quizLayouts.length > 0 && (
              <section className={styles.practice} aria-labelledby="home-practice">
                <h2 id="home-practice" className={styles.sectionTitle}>想試著自己找？</h2>
                <p className={styles.sectionNote}>回到同一張圖，練習認出剛看過的符號。</p>
                {quizLayouts.map((layout) => (
                  <AnalyticsLink
                    key={layout.id}
                    className={styles.learningButton}
                    href={`/layouts/${layout.id}/quiz`}
                    prefetch={false}
                    event={{
                      name: ANALYTICS_EVENTS.selectContent,
                      content_type: "home_quiz",
                      item_id: layout.id,
                      origin_page_type: "home",
                    }}
                  >
                    <span>{homeQuizButton(layout.name)}</span>
                    <span aria-hidden="true">→</span>
                  </AnalyticsLink>
                ))}
              </section>
            )}
          </div>
        </div>
        <div className={styles.brandCopy}>
          <p className={styles.brandPromise}>{BRAND_PROMISE}</p>
          <p className={styles.brandNote}>看屋前，或回家以後。<br />把不確定的地方，一格一格拼起來。</p>
        </div>
      </div>
    </main>
  );
}
