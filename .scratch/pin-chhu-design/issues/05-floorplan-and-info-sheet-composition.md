# 05 — 平面圖與 InfoSheet 的閱讀編排

Status: ready
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

- [ ] 375 × 812 與 320 × 568 的自由看圖頁沒有 document scroll／水平捲動，header、title、viewport 和 sheet 都可用。
- [ ] 打開／關閉／展開 InfoSheet 時，讀者仍能辨認正在看的圖面與目前 symbol，焦點與 reduced-motion 行為不退步。
- [ ] State 在彩色與灰階下仍可辨識，圖面牆／柱／文字明度關係沒有變化。
- [ ] 全部 pan-zoom、two-stage-tap、info-sheet、keyboard、layout page tests 通過。

## Validation

更新 `tests/layout-page.spec.ts`、`tests/info-sheet.spec.ts`、`tests/responsive-regressions.spec.ts`，並跑 `tests/pan-zoom.spec.ts`、`tests/two-stage-tap.spec.ts`、`tests/keyboard.spec.ts`。

