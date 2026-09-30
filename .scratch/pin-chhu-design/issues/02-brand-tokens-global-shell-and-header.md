# 02 — 品牌 tokens、global shell 與 Header

Status: resolved
Blocked by: 01

## Goal

將米白、深褐外框、木質棕、磚紅、清水灰的品牌層落成 token，並用 compact 拼厝 header 建立全站閱讀外殼，而不改寫圖面與 State contract。

## Scope

- 在 `app/globals.css`（必要時新建相鄰的品牌 token 檔）定義命名 brand／surface／rule／text tokens；不要散落 literal 色碼。
- 更新全站 body、連結、按鈕、focus-visible 與 `components/SiteHeader.tsx`／`.module.css`，使 header 是非浮動的一列、整組連回首頁。
- 維持 footer 與 route layout 行為；確保 header 加入後，layout／quiz 一螢幕的高度預算仍可由後續頁面票驗證。
- 只在 layout shell 與 editoral surfaces 加入克制的框線與格線 primitives；不要直接替內容頁套一堆卡片。

## Constraints

- `--fp-*` 和 `--state-*` 的意義、對比、灰階辨識與使用位置不變；不得以 brand token override 它們。
- 格線是背景節奏，不能落在圖面、Symbol Art、表單、表格或可點元素的 hit target 上。
- 文字對背景達 4.5:1；keyboard focus 保持黑白雙環；控制項保持至少 44 × 44 px hit target。
- 不加 webfont、dark mode、玻璃擬態、重陰影或全站大圓角卡片。

## Acceptance criteria

- [x] 全站 shell 使用命名 token，沒有跨頁硬寫的 brand 色值。
- [x] header 顯示 compact mark、拼厝與 Phin-Chhù，整組是單一回首頁連結，沒有 toolbar 化導覽。
- [x] 品牌背景／線條清楚但不壓過內容；圖面與 State 截圖和 token tests 證實不被色彩覆寫。
- [x] 375 × 812 與 320 × 568 上不出現 header 引起的水平捲動或不可用控制。

## Validation

擴充 `tests/design-language.spec.ts`、`tests/site-header.spec.ts` 與既有 focus／responsive test seam；跑完整 build。

## Comments

### 2026-09-30 — 實作與驗證

- `app/globals.css` 以票 01 的品牌原色定義 surface、text、rule tokens，既有 paper／ink 名稱轉接到閱讀外殼；全站米白底、深褐字與主要動作共用這組值。連結保留底線，按鈕預設提供最小觸控尺寸；黑白焦點環不變。
- Header 延用 compact mark 與單一首頁連結，調整字級、間距與深褐分隔線；維持原本高度預算與正常文件流。框線使用 shell token，首頁品牌欄與格線編排依交付順序留給票 03。
- 符號頁與分類縮圖容器改接 `--fp-paper`，避免透明 SVG 透出品牌底色。未改動圖面、State、資料、路由、footer 結構或 Analytics。
- TDD：閱讀底色／主要入口、Header 分隔線、Symbol Art 白紙檢查依序確認失敗後實作；補上 375 × 812／320 × 568 的跨頁 Header 與鍵盤焦點檢查，文字對比由瀏覽器解析 token 後驗證 AA。
- 首次完整回歸發現既有高度測試以固定延遲量到動畫末幀；改為等待說明卡 transition 的 `finished`，連續 5 次高度檢查通過。最終 `npm run typecheck` 與完整 `PORT=3107 npm test -- --workers=4` 通過，共 276 tests，包含 production build、資料／FloorPlan validation、互動、SEO 與 Analytics 回歸。
- Chromium 目視檢查手機首頁、桌機符號頁。以票 01 結束的 `efffa61` 比較 normal、candidate、selected、highlighted、revealed 五種 State：圖框尺寸相同、圖面內部像素完全一致。selected／revealed 截圖因小數座標裁切帶入外側最多 1 CSS px 的新米白背景，差異僅在上下邊緣；比對報告及截圖存於本機 `test-results/ticket-2-qa/`。
- 品牌產物與圖面資料 `git diff --exit-code -- public/brand data` 通過；CodeGraph 已同步。無新增詞彙或推翻既有決策，不需修改 CONTEXT／ADR。
- Standards review：0 項；Spec review：0 項（比較基準 `efffa61`）。
