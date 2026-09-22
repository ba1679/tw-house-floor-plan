import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { SearchBox } from "@/components/SearchBox";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { hasQuiz } from "@/lib/quiz/questions";
import { homeMetadata, homeWebsiteJsonLd, jsonLd } from "@/lib/site-metadata";
import { loadCategories, loadSearchIndex } from "@/lib/symbols/data";
import {
  CATEGORY_LABELS,
  HOME_BROWSE_LABEL,
  HOME_CLAIM,
  SITE_NAME,
  SITE_TAGLINE,
  homeLayoutButton,
  homeQuizButton,
} from "@/lib/ui/copy";
import styles from "./page.module.css";

// 首頁是「首頁 → 平面圖」那條入站路徑的起點（PRD §8）。它**不是**主要入口——大多數人從 Google
// 直接落在符號頁（§6.2.1）——所以這一頁要小：一句主張、進平面圖與找找看的按鈕、搜尋框、分類入口。
// 不做長篇產品敘事、示意圖、統計數字、動畫（票 07）。
//
// 先後照票面那一句話的先後：先知道這裡在幹嘛，然後直接進圖；想查特定符號的往下一格，想瀏覽的再往下。

// 自己的標題、描述、canonical 與 Open Graph 都走同一個 metadata 邊界；下一批頁面可沿用同一個入口。
export const metadata: Metadata = homeMetadata();

export default function HomePage() {
  // **有幾個 layout 就有幾個按鈕，由 `data/layouts/` 決定。** 今天只有三房兩廳，所以就是一個。
  // 不挑「第一張」當主打：哪一張該被主打是一個編輯決定，而那個決定不該藏在排序裡；
  // 也不寫死 `3b2l_standard`（spec「路由」）——M6 加第 2 張圖時，它自己長出第二個按鈕。
  const layouts = listLayoutIds().map((id) => {
    const floorplan = loadFloorPlan(id);
    return { id, name: floorplan.name, hasQuiz: hasQuiz(floorplan.hotspots) };
  });

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeWebsiteJsonLd()) }}
      />
      <div className={styles.column}>
        <p className={styles.site}>{SITE_NAME}</p>
        <h1 className={styles.title}>{HOME_CLAIM}</h1>
        <p className={styles.lede}>{SITE_TAGLINE}</p>

        <div className={styles.layouts}>
          {layouts.map((layout) => (
            <Fragment key={layout.id}>
              <Link className={styles.layoutButton} href={`/layouts/${layout.id}`}>
                {homeLayoutButton(layout.name)}
                {/* 箭頭是給看得見的人的方向感；讀螢幕的人聽到「開始探索三房兩廳」就夠了。 */}
                <span aria-hidden="true">→</span>
              </Link>
              {/* 找找看的入口（M4 票 06）：想從玩開始的人從這裡走。與進圖的按鈕同樣由資料產生，
                  只替有找找看頁的圖產生——與找找看頁產不產生問的是同一句 `hasQuiz`。 */}
              {layout.hasQuiz && (
                <Link className={styles.quizButton} href={`/layouts/${layout.id}/quiz`}>
                  {homeQuizButton(layout.name)}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </Fragment>
          ))}
        </div>

        {/* 想查特定符號的人從這裡走。與分類頁上的是同一個元件、同一份索引（`loadSearchIndex()`）。 */}
        <SearchBox index={loadSearchIndex()} />

        {/* 想一類一類看完的人從這裡走。有哪幾類由 `loadCategories()` 從資料算出，中文名從 `CATEGORY_LABELS` 來——
            與分類頁自己用的是同一份，這裡不另外手寫一份「就這 3 類」（PRD §9「不得各自維護副本」）。
            每一類不附「共 N 個符號」：那一行是分類頁清單的前言，離開清單就只剩一個數字，而這一頁要小。 */}
        <nav className={styles.browse} aria-labelledby="home-browse">
          <h2 id="home-browse" className={styles.browseLabel}>
            {HOME_BROWSE_LABEL}
          </h2>
          <ul className={styles.categories}>
            {loadCategories().map((category) => {
              const label = CATEGORY_LABELS[category.id];
              return (
                <li key={category.id} className={styles.categoryItem}>
                  <Link className={styles.categoryLink} href={`/categories/${category.id}`}>
                    <span className={styles.categoryName}>{label.zh}</span>
                    {/* 英文小字對讀螢幕的人是重唸一次同一個名字。 */}
                    <span className={styles.categoryEn} aria-hidden="true">
                      {label.en}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </main>
  );
}
