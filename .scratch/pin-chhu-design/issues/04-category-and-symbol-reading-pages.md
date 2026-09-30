# 04 — 分類目錄與符號條目的編輯閱讀頁

Status: resolved
Blocked by: 01, 02

## Goal

讓分類頁能像目錄快速掃讀、符號頁能像條目慢慢讀，同時保持 Symbol Art、source tier 與出處資料的順序、來源與語意不變。

## Scope

- 更新 `app/categories/[id]/page.tsx` 與 `.module.css` 的目錄排列與項目 affordance。
- 更新 `app/symbols/[id]/page.tsx` 與 `.module.css`，並視需要調整 `SymbolArt`、`SourceTierPanel`、`SourceBadge` 的呈現 CSS。
- 使用細框、對齊、有限色塊索引與局部格線表現閱讀節奏；保留 existing data loader、metadata、related layout conversion point 與 tracking。

## Constraints

- Symbol Art 是 floorplan sprite 的放大局部，不得另畫圖示或加入窗花／brand 色填滿。
- Source Tier 的線型／填色區別是內容語意，不得用品牌色重編碼；完整 source refs 的筆數與次序不變。
- 不新增條目編號、額外說明欄位或虛構文案；category 不能用顏色教使用者分類。

## Acceptance criteria

- [x] 三個分類頁可以用 heading、名稱、白話與可見連結快速掃讀，鍵盤與讀螢幕順序對資料順序一致。
- [x] 符號頁清楚區分 Symbol Art、白話解釋、Source Tier、出處、容易搞混與前往格局；原有內容沒有遺失或重排成錯誤語意。
- [x] 讀物頁在窄螢幕有可讀行寬，desktop 的分欄／格線不降低正文對比或選取文字。
- [x] 現有 metadata、source refs、conversion point、symbol view analytics tests 都通過。

## Validation

更新 `tests/category-page.spec.ts`、`tests/symbol-page.spec.ts`、`tests/source-refs.spec.ts`、`tests/conversion-point.spec.ts`；目視 375px 與 desktop。

## Comments

### 2026-09-30 — 實作與驗證

- 分類頁以連續目錄呈現，每列有 Symbol Art、可供 heading 導覽的符號名稱、完整白話與裝飾箭頭。桌機只展開列內欄位，沒有把資料切成多欄；底線名稱、整列連結與原有 Analytics payload 保留。
- 符號頁以標題／Source Tier 的頁首、Symbol Art／正文的分欄建立閱讀節奏。手機依 DOM 回到單欄；正文最多 560px。細框、段落分隔與較清楚的出處文件名取代大圓角容器，沒有在正文或符號上加裝飾格線。
- 欄位順序遵循 M3 spec 的既定決議：標題 → 大尺寸來源徽章 → Symbol Art → 白話意思 → 容易搞混 → 有資料才出現的注意事項 → 完整出處 → 格局入口。票面的列舉不是重排授權。來源層級仍用原本的線型與填色，出處清單保留原始筆數、順序與有／無連結的呈現。
- TDD 在票面指定的頁面 seam 先確認「逐項 heading」與「桌機圖文並排、正文行寬」失敗，再實作通過；補上所有符號的閱讀順序、所有出處清單的順序及語意、窄螢幕／桌機格局入口鍵盤操作（包含樑特例）。
- 相關 74 tests 分段通過；最終 `npm run typecheck`、`SITE_URL=https://floorplan.example.test NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST12345 npm run build` 與完整 `PORT=3108 npm test -- --workers=4` 通過，共 288 tests。Build 包含資料、FloorPlan 與 domain validation；樑無熱區的既有提示維持預期，domain validation 為 0 blockers。
- Chromium 目視三個分類頁及牆、雨遮、一般單開門的 320／375／1280px 版本；18 組尺寸均無水平溢出，桌機可對照圖文、手機可讀完整正文。截圖與尺寸紀錄存於本機 `test-results/ticket-4-qa/`。
- 對 `b379ce8` 檢查資料、SymbolArt、metadata、Analytics、圖面／State tokens 均無 diff。CodeGraph 已同步；未新增領域詞彙或推翻 ADR。
- Code review 以 `b379ce8` 為本票比較基準：Standards 0 findings；Spec 0 findings。
