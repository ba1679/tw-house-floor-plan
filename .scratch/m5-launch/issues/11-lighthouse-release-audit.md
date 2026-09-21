# 11: 本機 Lighthouse 發布稽核

**What to build:** 讓開發者用一個本機命令，就能對 production build 的五種代表頁重現 M5 的 Lighthouse 驗收，並修正所有會讓適用分數低於 90 的問題。

**Blocked by:** 02 / 自由看圖與找找看的 `symbol_view`；09 / 完整頁面 metadata 與 JSON-LD；10 / 代表頁 RWD 與既有操作回歸

**Status:** ready-for-agent

- [ ] 提供單一 `npm run audit`，能建置／連接靜態站並執行同一份 Lighthouse 設定，不要求人工排列多個 shell 步驟
- [ ] 固定稽核首頁、一張 FloorPlan、一張 Symbol、一張分類與一張找找看，全部使用真資料中存在的代表 id
- [ ] 使用 Lighthouse mobile 模擬，每張頁收集三次，以中位結果判斷
- [ ] 首頁、FloorPlan、Symbol、分類的 Performance、Accessibility、Best Practices、SEO 全部至少 0.90
- [ ] 找找看的 Performance、Accessibility、Best Practices 至少 0.90；不因刻意 `noindex` 對 SEO category 設分數 gate
- [ ] 找找看的 noindex 與 sitemap 排除仍由頁面行為測試保證，不因 Lighthouse 例外而放掉
- [ ] 修分數時不刪除核心內容、來源揭露、鍵盤語意或 Analytics 正確性，也不偏離既有 Design Language
- [ ] Audit 對 build 產物執行，不以不穩定的 production 網路分數作為本機門檻
- [ ] 失敗輸出能指出頁面、category、實際分數與門檻，讓 CI 日後可直接採用
