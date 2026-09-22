# 09: 完整頁面 metadata 與 JSON-LD

**What to build:** 讓每張可索引的 Symbol、分類與 FloorPlan 頁都用自己的內容產生 canonical、分享預覽與正確 Schema.org 語意，同時讓找找看維持明確的 noindex 邊界。

**Blocked by:** 08 / 首頁分享識別與 SEO foundation

**Status:** done

- [x] 每張 Symbol、分類、FloorPlan 頁都有不含 query 的絕對 canonical
- [x] `?from=search`、`?from=category` 與其他 query 不會改變 Symbol 頁 canonical 或 Open Graph URL
- [x] 每張頁面的 Open Graph title／description 沿用既有 page-specific 文案，不另維護第二份標題與描述
- [x] 所有頁面共用票 08 的 1200 × 630 OG 圖與 site identity
- [x] 每張 Symbol 頁輸出 `DefinedTerm`，名稱、白話意思、URL 與該 Symbol 真實資料一致
- [x] 每張分類頁輸出 `CollectionPage`，其中的 Symbol 集合與畫面清單一個不多、一個不少，順序同源
- [x] 每張 FloorPlan 頁輸出 `LearningResource`，只描述頁面真的提供的名稱、教學用途、語言與免費存取
- [x] 找找看維持 `noindex`、不進 sitemap、完全不輸出 JSON-LD；基本分享 metadata 不會把它變成可索引頁
- [x] JSON-LD 不使用 `Article`、rating、FAQ、課程證照或頁面上不存在的內容
- [x] 全部生成頁的 build HTML 都通過 JSON parse、絕對 URL 與資料一致性測試；Lighthouse 只需抽代表頁
