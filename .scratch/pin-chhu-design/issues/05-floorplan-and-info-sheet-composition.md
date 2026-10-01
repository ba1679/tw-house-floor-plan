# 05 — 平面圖與 InfoSheet 的閱讀編排

Status: resolved
Blocked by: 02

## Goal

將平面圖頁與 InfoSheet 置入拼厝閱讀系統：圖仍是主角，說明仍是一張升起來的版面列；品牌框線與編輯節奏只能幫助區分，不得侵入圖面與 State。

## Scope

- 調整 `app/layouts/[id]/page.tsx`／`.module.css`、`components/FloorPlanViewer.module.css`、`components/InfoSheet.module.css` 等 composition CSS。
- 建立清楚的圖框、標題列、說明列與控制區層級；InfoSheet 內文、source badge、confused-with 與 other occurrences 維持原有結構與 focus behavior。
- 針對 header 加入後，重新調整一螢幕高度預算與 sheet 開啟時的圖面可視帶。

## Constraints

- 不改 `FloorPlanViewport`／`FloorPlanRenderer` 對 FloorPlan、State、hit-test、pan／zoom 的 Interface；不改 `--state-*` 或牆柱、家具、符號、文字等 `--fp-*` 語意。指定房型地板色依 DESIGN.md 的使用者核准配對呈現。
- InfoSheet 仍是 layout row、唯一可有結構性陰影的表面，不可改為 modal、drawer 或蓋住圖面的 floating card。
- 無 document scroll；圖面仍可看見、控制可用；不改 existing analytics、highlight query 或 keyboard ownership。

## Acceptance criteria

- [x] 375 × 812 與 320 × 568 的自由看圖頁沒有 document scroll／水平捲動，header、title、viewport 和 sheet 都可用。
- [x] 打開／關閉／展開 InfoSheet 時，讀者仍能辨認正在看的圖面與目前 symbol，焦點與 reduced-motion 行為不退步。
- [x] State 在彩色與灰階下仍可辨識，圖面牆／柱／文字明度關係沒有變化。
- [x] 全部 pan-zoom、two-stage-tap、info-sheet、keyboard、layout page tests 通過。

## Validation

更新 `tests/layout-page.spec.ts`、`tests/info-sheet.spec.ts`、`tests/responsive-regressions.spec.ts`，並跑 `tests/pan-zoom.spec.ts`、`tests/two-stage-tap.spec.ts`、`tests/keyboard.spec.ts`。

## Comments

### 2026-09-30 — 實作與驗證

- 自由看圖以細框區分白色圖面與米白閱讀面，標題／找找看入口、狀態列、圖面工具各有清楚的層級；桌機限制整體寬度。圖框使用不參與 content box 的 outline，保留 ResizeObserver 與手勢座標的既有一致性。
- 自由看圖的 main 依實際可用高度給 InfoSheet 上限，展開時至少保留 84px 圖面帶。此預算只掛在自由看圖；找找看的額外題目／作答列由票 06 處理。InfoSheet 仍為版面列，免責與控制列都留在螢幕內。
- 說明卡以細分隔線、較清楚的欄位字重與小圓角控制整理閱讀順序。展開／收合按鈕改成正文下方獨立列，最後一段能捲到按鈕上方；溢出量測扣除按鈕自己占用的空間，短說明仍不顯示不必要的展開入口。原有資料結構、焦點、關閉與 reduced-motion 行為保留。
- TDD 先重現展開時圖框在 375 × 812 只剩約 18.6px、320 × 568 歸零且卡片底部被裁切，以及正文末段被展開控制遮住，再完成修正。新測試覆蓋兩個手機尺寸、桌機完整開合、正文捲至末尾與收合後焦點／捲動位置。
- 保留收合時原有的 46dvh 上限。曾驗證增加為 48dvh 會在 375 × 700 的既有 pan／zoom 案例觸發視野邊界限制，開關後留下 4.4px 偏移；等待動畫完成仍能穩定重現。最後以調整卡片內部間距容納短說明，沒有改 viewer state 或換算規則，原測試通過。
- `npm run typecheck`、`SITE_URL=https://floorplan.example.test NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST12345 npm run build` 及完整 `PORT=3108 npm test -- --workers=4` 通過，共 293 tests。Build 包含資料、FloorPlan 與 domain validation；樑無熱區的既有提示維持預期，domain validation 為 0 blockers。
- Chromium 目視 320／375／1280px 的初始、開啟、展開、捲到底與收合畫面，以及 normal／candidate／selected／highlighted 的彩色與灰階；圖面牆、柱、文字及 State 規則未修改。額外逐一檢查 320 × 568／reduced motion 下全部 37 個 Hotspot 的鍵盤開卡與展開，皆保留圖面、可捲正文與完整卡片，無 document scroll。截圖、尺寸與測試紀錄存於本機 `test-results/ticket-5-qa/`。
- Code review 以 `e0b6f7e` 為基準：Standards 指出的次要控制配色文件落差，已在 `DESIGN.md` 補上限於圖面工具與 InfoSheet 的例外及閱讀優先理由；複查後 Standards 0 未解 findings、Spec 0 findings。CodeGraph 已同步，未新增領域詞彙或推翻 ADR。

### 2026-10-01 — 使用者核准的房型色彩例外

- 使用者提供新版 Logo／OG／favicon 方向及指定色票，並確認橡木棕用於主臥、暖陶土用於客廳、燕麥奶白用於餐廳與廚房、鼠尾草綠用於衛浴與陽台。
- 此為地板填色的限定視覺索引，不推論方位，不更動 State、牆柱、家具、符號、房名、互動或資料 schema；未列房型保留中性底色。
- React renderer 與離線 SVG renderer 使用相同房型配對；InfoSheet 開啟時仍依各房底色暗化，關閉時還原。首頁縮圖與找找看共用 React renderer，無另建資料或改寫產生出的 FloorPlan JSON。
- 提交前回歸發現未指定房型的底色與 Symbol Art fallback 不一致，已還原既有中性灰 token；四組核准房型色不變。`PORT=3109 npm test -- tests/design-language.spec.ts tests/site-header.spec.ts tests/floorplan-renderer.spec.ts tests/home-metadata.spec.ts tests/home-page.spec.ts tests/quiz-feedback.spec.ts tests/layout-page.spec.ts --workers=4 --reporter=dot` 最終 48 tests 通過，含 production build 與資料／FloorPlan validation；typecheck、設計偵測及 diff whitespace 檢查通過。品牌產物重生後雜湊一致；這次未跑全套 tests，票 07 仍保留完整跨頁驗收。
