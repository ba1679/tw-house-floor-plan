# 01 — 首頁開場、讀圖桌與手機品牌位置

Status: resolved

## Goal

落實 [spec](../spec.md)，讓完整台灣拼圖在手機開場出現，以字級、句意換行與留白改善首頁吸引力。

## Scope

`app/page.tsx`、`app/page.module.css`、`tests/home-page.spec.ts` 與 `DESIGN.md` 的首頁規則。

## Validation

production build、TypeScript、首頁／設計語言／導覽／搜尋／Analytics 回歸；Chromium 批次檢視手機、桌機、平板、橫向及放大後版面。

## Comments

### 2026-10-02 — 方向與實作

- 初始工作目錄乾淨，以 `810b2e1411b3edce1ff575a87eb2f51fe3d0126b` 為本次 diff 的固定點。
- 使用 impeccable 的 layout 視覺評估與獨立機械掃描；原始手機標記位於約 y=1278，而主要按鈕在 320 × 568 已低於首屏。
- 標記移至 intro 的獨立品牌面；品牌承諾留作克制收尾。主張沿用 `HOME_CLAIM`，只按句意安排字級與換行。
- 縮圖仍沿用 `FloorPlanRenderer`，所有 route、Analytics payload、搜尋與分類來源保留；桌機讀圖與工具並排，手機保持讀圖 → 搜尋／分類 → 練習。
- 新排版延續既有設計語言；未新增領域詞彙或推翻 ADR。


### 2026-10-02 — 最終驗證

- `SITE_URL=https://floorplan.example.test NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST12345 npm run build` 成功，含 TypeScript、資料及 FloorPlan validation；資料端只有既有的樑無熱區提示，domain validation 無 blocker。
- `PORT=3110 npm test -- tests/home-page.spec.ts tests/design-language.spec.ts tests/site-header.spec.ts tests/home-metadata.spec.ts tests/analytics.spec.ts tests/search-box.spec.ts tests/search-matching.spec.ts --workers=4`：50 passed。
- 新版搜尋位置會在聚焦捲動時把分類／練習入口帶進視野，Next Link 的預抓因而產生與搜尋無關的請求；這些次要入口使用 `prefetch={false}`，既有「搜尋不打網路」回歸恢復通過，連結目標與事件不變。
- Chromium 375 × 812、320 × 568、1280 × 900、768 × 1024、812 × 375、640 × 450 均無水平溢出；長查詢、長格局名、搜尋結果展開也無溢出。640 CSS px 為寬桌機放大後的 reflow 檢查，未以實機 Safari／Android 驗證。
- 375px 標記 y=84–245，主要按鈕 y=619.56–667.56；320px 標記 y=68–229，主要按鈕 y=498.19–546.19。按鈕高度 48px，黑白焦點雙環保留；圖面面積均大於標記。
- 正確 production preview 為 `http://localhost:3110`，由本工作目錄的 `out/` 提供。曾誤用另一 checkout 的 3108 server；已棄用該輪驗證並對照 served HTML 與本機 build 完全一致後重新驗證。
- 最終畫面與尺寸紀錄：`test-results/home-mobile-layout/`（本機忽略產物）。版面機械掃描 `[]`，`git diff --check` 通過；兩軸 source review：Standards 0、Spec 0。無新領域詞彙或 ADR 變更。


### 2026-10-02 — 改用文案換行與 CSS pre-line

- 依使用者要求，把主張的句意換行直接寫為 `HOME_CLAIM` 的換行字元；移除首頁的 `indexOf`、`slice` 與嵌套 span。
- h1 以 `white-space: pre-line` 呈現三行主張，首行的較小字級／字重由 `::first-line` 負責，桌機與手機使用同一份指定換行。
- production build 成功；首頁及設計語言回歸 18 passed。Chromium 375 × 812、320 × 568、1280 × 900 無水平溢出，三個尺寸均保留完整首屏讀圖按鈕。
- 版面掃描 `[]`；本輪畫面存於 `test-results/home-mobile-layout/pre-line-*.png`。


### 2026-10-02 — 提交與 PR 整理

- 本次首頁變更獨立整理到 `codex/home-mobile-layout`，以遠端 `main` 的 `285c71e` 為基底；既有四筆未推送提交保留在原分支 `codex/install-impeccable-skill`。
- PR diff 僅包含本票的七個檔案，沒有帶入既有找找看回饋、InfoSheet 或 State 調整。
- 以 PR 基底重新 production build 成功；相同七組首頁／設計語言／導覽／metadata／Analytics／搜尋測試共 49 passed（main 與原實作基底的測試清單不同）。
