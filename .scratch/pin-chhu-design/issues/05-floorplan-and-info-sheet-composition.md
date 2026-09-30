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

- 不改 `FloorPlanViewport`／`FloorPlanRenderer` 對 FloorPlan、State、hit-test、pan／zoom 的 Interface；不把品牌色畫進 `--fp-*`／`--state-*`。
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
