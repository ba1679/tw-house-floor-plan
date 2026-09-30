# 06 — 找找看的明確作答結果

Status: ready
Blocked by: 02, 05

## Goal

讓讀者在作答的瞬間，不靠色彩或猜圖上標記就知道答對／答錯；結果區宣告判定，InfoSheet 則保留後續理解。

## Scope

- 在 `components/QuizRound.tsx` 與 `components/Quiz.module.css`，依 Round answer 和現有 names 於 viewport 與後續 controls 之間渲染固定結果區。
- 答對呈現深褐實心、勾、`答對` 與 `你找到了「X」`；答錯呈現深褐強框、`答錯`、`你點的是「Y」` 與 `正確答案是「X」`。
- 結果訊息在作答後以可被輔助技術宣布的文字呈現；答錯仍用既有 flow 自動打開題目 Symbol 的 InfoSheet。

## Constraints

- `isCorrect`、Round phase、pause、next question、progress record 與錯答開 Sheet 的 ownership 不變。
- `FloorPlanViewport` 只接既有 State／interaction，不能新增 `correct`／`incorrect` copy props 或 quiz-only layout ownership。
- 不使用紅綠、煙火、抖動、閃爍、慶祝動畫，或品牌磚紅來當「錯誤色」。

## Acceptance criteria

- [ ] 作答後無論答對錯，結果區立即、固定且可見，包含正確／被點符號的真實名字。
- [ ] 答錯時結果區與題目 Symbol 的 InfoSheet 同時存在，`confused_with` 差異仍可閱讀；答對時不強迫開 Sheet。
- [ ] 控制項順序、鍵盤焦點、下一題、結算與 screen-reader announcement 正確；一局暫停規則不變。
- [ ] 不侵入自由看圖頁，且既有 quiz analytics／progress tests 與 viewport test seam 都通過。

## Validation

擴充 `tests/quiz-feedback.spec.ts`、`tests/quiz-page.spec.ts`、`tests/quiz-progress.spec.ts`、`tests/quiz-play.ts`；用鍵盤、讀螢幕 tree 與 reduced-motion 實測。

