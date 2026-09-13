import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { listLayoutIds, loadFloorPlan } from "@/lib/floorplan/data";
import { loadCategories, loadSearchIndex } from "@/lib/symbols/data";
import {
  CATEGORY_LABELS,
  HOME_BROWSE_LABEL,
  HOME_CLAIM,
  HOME_LEDE,
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
  SITE_NAME,
  homePlanButton,
} from "@/lib/ui/copy";
import styles from "./page.module.css";

// 首頁是「首頁 → 平面圖」那條入站路徑的起點（PRD §8）。它**不是**主要入口——大多數人從 Google
// 直接落在符號頁（§6.2.1）——所以這一頁要小：一句主張、一個進平面圖的按鈕、搜尋框、分類入口。
// 不做長篇產品敘事、示意圖、統計數字、動畫（票 07）。
//
// 先後照票面那一句話的先後：先知道這裡在幹嘛，然後直接進圖；想查特定符號的往下一格，想瀏覽的再往下。

// 自己的標題與描述。沿用根版面那一句「平面圖教學」的話，首頁與 404 頁在搜尋結果上同名。
export const metadata: Metadata = {
  title: HOME_PAGE_TITLE,
  description: HOME_PAGE_DESCRIPTION,
};

export default function HomePage() {
  // **有幾張圖就有幾個按鈕，由 `data/layouts/` 決定。** 今天只有一張，所以就是一個。
  // 不挑「第一張」當主打：哪一張該被主打是一個編輯決定，而那個決定不該藏在排序裡；
  // 也不寫死 `3b2l_standard`（spec「路由」）——M6 加第 2 張圖時，它自己長出第二個按鈕。
  const layouts = listLayoutIds().map((id) => ({ id, name: loadFloorPlan(id).name }));

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <p className={styles.site}>{SITE_NAME}</p>
        <h1 className={styles.title}>{HOME_CLAIM}</h1>
        <p className={styles.lede}>{HOME_LEDE}</p>

        <div className={styles.plans}>
          {layouts.map((layout) => (
            <Link key={layout.id} className={styles.planButton} href={`/layouts/${layout.id}`}>
              {homePlanButton(layout.name)}
              {/* 箭頭是給看得見的人的方向感；讀螢幕的人聽到「開始探索三房兩廳」就夠了。 */}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

        {/* 想查特定符號的人從這裡走。與分類頁上的是同一個元件、同一份索引（`loadSearchIndex()`）。 */}
        <SearchBox index={loadSearchIndex()} />

        {/* 想一類一類看完的人從這裡走。有哪幾類由 `loadCategories()` 從資料算出，中文名從 `CATEGORY_LABELS` 來——
            與分類頁自己用的是同一份，這裡不另外手寫一份「就這 3 類」（PRD §9「不得各自維護副本」）。
            每一類不附「共 N 個符號」：那是分類頁自己的前言，放到首頁就成了票面不要的統計數字。 */}
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
