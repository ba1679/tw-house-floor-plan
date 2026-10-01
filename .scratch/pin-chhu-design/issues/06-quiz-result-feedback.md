# 06 — 找找看的明確作答結果

Status: ready
Blocked by: 02, 05

## Goal

讓讀者在作答的瞬間，不靠色彩或猜圖上標記就知道答對／答錯；結果區宣告判定，InfoSheet 則保留後續理解。

## Scope

- 在 `components/QuizRound.tsx` 與 `components/Quiz.module.css`，依 Round answer 和現有 names 於 viewport 與後續 controls 之間渲染固定結果區。
- 答對呈現深碳灰實心、勾、`答對` 與 `你找到了「X」`；答錯呈現深碳灰強框、`答錯`、`你點的是「Y」` 與 `正確答案是「X」`。使用現行閱讀介面的 text／surface／rule tokens，色值以 CSS 為準。
- 結果訊息在作答後以可被輔助技術宣布的文字呈現；答錯仍用既有 flow 自動打開題目 Symbol 的 InfoSheet。
- Quiz composition 需計入 header、題目、結果區、動作列、InfoSheet 與 footer 的高度；結果文字可換行，Sheet 的收合／展開上限需依 Quiz 的可用空間計算。

## Constraints

- `isCorrect`、Round phase、pause、next question、progress record 與錯答開 Sheet 的 ownership 不變。
- `FloorPlanViewport` 只接既有 State／interaction，不能新增 `correct`／`incorrect` copy props 或 quiz-only layout ownership。
- 房型底色沿用共享 renderer；不以暖陶土、鼠尾草綠或其他房型色表示正誤，亦不因答對／答錯換房間底色。既有 selected／revealed 標記與 Sheet 暗化依原本的房間歸屬呈現。
- 不使用紅綠、煙火、抖動、閃爍或慶祝動畫。
- 不將票 05 的自由看圖高度預算原封不動套到 Quiz；額外題目、結果和動作列由 Quiz composition 負責。

## Acceptance criteria

- [ ] 作答後無論答對錯，結果區立即、固定且可見，包含正確／被點符號的真實名字。
- [ ] 答錯時結果區與題目 Symbol 的 InfoSheet 同時存在，`confused_with` 差異仍可閱讀；答對時不強迫開 Sheet。
- [ ] 375 × 812 與 320 × 568 下，答對、答錯、關 Sheet、展開／收合 Sheet 後均無 document scroll 或水平捲動；結果完整可讀、下一題控制可用，且 Sheet 展開時仍保留至少 84 CSS px 的圖面可視帶（票 05 的既有預算）。
- [ ] 控制項順序、鍵盤焦點、下一題、結算與 screen-reader announcement 正確；一局暫停規則不變。
- [ ] 不侵入自由看圖頁，且既有 quiz analytics／progress tests 與 viewport test seam 都通過。

## Validation

擴充 `tests/quiz-feedback.spec.ts`、`tests/quiz-page.spec.ts`、必要的 `tests/responsive-regressions.spec.ts` 與 `tests/quiz-play.ts` helper；跑 quiz progress／analytics 既有回歸。使用最長的現有符號名稱及含 confused-with 差異句的錯答，檢查兩個手機尺寸的結果／圖面／Sheet／動作列；以鍵盤、accessibility tree 與 reduced-motion 核對即時宣告與焦點。

## Comments

### 2026-10-01 — 配合新版品牌與房型色

- 對齊現行深碳灰結果區與房型色規則，補上 Quiz 自有高度預算、窄螢幕文字換行及 Sheet 開合的驗收。票 01–05 已完成，本票維持 ready；此更新不代表結果區已實作。
