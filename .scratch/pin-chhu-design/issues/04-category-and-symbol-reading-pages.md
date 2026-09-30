# 04 — 分類目錄與符號條目的編輯閱讀頁

Status: ready
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

- [ ] 三個分類頁可以用 heading、名稱、白話與可見連結快速掃讀，鍵盤與讀螢幕順序對資料順序一致。
- [ ] 符號頁清楚區分 Symbol Art、白話解釋、Source Tier、出處、容易搞混與前往格局；原有內容沒有遺失或重排成錯誤語意。
- [ ] 讀物頁在窄螢幕有可讀行寬，desktop 的分欄／格線不降低正文對比或選取文字。
- [ ] 現有 metadata、source refs、conversion point、symbol view analytics tests 都通過。

## Validation

更新 `tests/category-page.spec.ts`、`tests/symbol-page.spec.ts`、`tests/source-refs.spec.ts`、`tests/conversion-point.spec.ts`；目視 375px 與 desktop。

