# 03 — 首頁讀圖桌與既有功能入口

Status: resolved
Blocked by: 01, 02

## Goal

把首頁改為原型 C 的讀圖桌：先看懂網站用途，再從真實格局開始，最後提供既有搜尋、分類與找找看的下一步；原型 A 的完整 logo 與原型 B 的格線只提供低密度節奏。

## Scope

- 重編 `app/page.tsx` 與 `app/page.module.css`，不改 Home metadata、JSON-LD、layout data source 或既有連結目標。
- 首屏安排：拼厝引言、明確的建案平面圖用途、目前可讀的真實格局／忠實縮圖、主 CTA「讀這張圖」。
- 讓完整 mark 位於獨立品牌面，格線只存在於這個面或留白節奏；格局與 CTA 的視覺權重必須更高。
- 將既有符號搜尋、分類與找找看入口編排為明確的次要行動；不可發明收藏數、推薦分數或新資料。

## Constraints

- 不使用原型 B 的整片深色 hero、旋轉平面圖、直排品牌欄；不複製 prototype-only switcher 或任何 prototype CSS。
- 不在縮圖上換房間色、不把 brand 色當 State、不改任何 href、Analytics link tracking 或可存取名稱。
- 文字選取、語意 heading、鍵盤順序和搜尋 landing 的清楚度不可退步。

## Acceptance criteria

- [x] 375 × 812 首屏同時能理解「拼厝教人讀建案平面圖」並看見前往格局的主要入口。
- [x] 真實格局／縮圖比完整品牌裝飾更突出，且點擊區域清楚、至少 44px。
- [x] 搜尋、三個分類與找找看皆導向原有 route、保留原有 Analytics contract。
- [x] desktop 有克制的編輯分欄與低密度格線；手機折成單欄後不留空洞、不水平溢出。

## Validation

更新 `tests/home-page.spec.ts`、必要的 search／analytics tests；Playwright 目視 375 × 812、320 × 568、desktop。

## Comments

### 2026-09-30 — CTA 命名解讀

Scope 指定主 CTA「讀這張圖」，Constraints 又要求不改可存取名稱；舊名稱是「開始探索三房兩廳」。本次實作以新的可見 CTA 為準，採「讀這張圖：{格局名}」作為畫面與可存取名稱，保留讀者操作前就知道格局的資訊，也避免語音操作時畫面文字與名稱不一致。此解讀已在對話中提出澄清並說明暫採方案，未聲稱使用者另行確認；其他入口名稱、href 與 Analytics contract 不變。

### 2026-09-30 — 實作與驗證

- 已讀 `prototype/pin-chhu` 的 `843bf77`：`VariantC` 與對應 CSS 為版面參考，B 僅借用低密度格線。實作保留既有首頁問句，把原型橫向格局列調整為能容納真實圖面的較大圖框；沒有複製原型 CSS、假縮圖或 switcher。
- 首頁由既有 `listLayoutIds`／`loadFloorPlan` 載入資料，以同一個 `FloorPlanRenderer` 呈現縮圖，不另畫房間或覆寫圖面色。主 CTA 延用原本 route 與 `home_layout` Analytics payload。
- 搜尋與分類共用既有 `SearchBox`／`loadCategories`；找找看仍以 `hasQuiz` 決定入口與 `home_quiz` 事件。新增鍵盤順序及入口單次 Analytics 回歸檢查。
- 完整 `BrandMark` 位於獨立品牌面，格線只畫在標記背景，承諾文字另置純色面。桌機為不對稱分欄，手機依序顯示格局、搜尋／分類、練習及品牌面；品牌面不搶首屏入口。
- TDD 先確認首屏用途／縮圖、獨立品牌面、CTA 名稱測試失敗，再各自實作；相關檔案分段測試通過。最終 `npm run typecheck` 及完整 `PORT=3107 npm test -- --workers=4` 通過，共 279 tests，含 production build、資料／FloorPlan validation、SEO、搜尋、Analytics 與既有互動回歸。
- Playwright／Chromium 目視 375 × 812、320 × 568、1280 × 900；均無水平溢出。375px 主要入口位於 y=566–614px，尺寸 301 × 48px；縮圖與用途同在首屏。完整截圖、首屏截圖與尺寸紀錄存於本機 `test-results/ticket-3-qa/`。
- 對票 02 結束的 `ee2a2d1` 驗證 metadata、圖面 renderer、品牌／圖面／State tokens、品牌產物及資料皆無 diff。CodeGraph 已同步；未新增領域詞彙或推翻 ADR。
- Standards review：0 項。Spec review：無功能／版面缺陷，1 項上述 CTA 名稱的規格衝突；兩軸均核對 C 的工具優先骨架與品牌／圖面分離。
