# 06 — 找找看的明確作答結果

Status: resolved
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

- [x] 作答後無論答對錯，結果區立即、固定且可見，包含正確／被點符號的真實名字。
- [x] 答錯時結果區與題目 Symbol 的 InfoSheet 同時存在，`confused_with` 差異仍可閱讀；答對時不強迫開 Sheet。
- [x] 375 × 812 與 320 × 568 下，答對、答錯、關 Sheet、展開／收合 Sheet 後均無 document scroll 或水平捲動；結果完整可讀、下一題控制可用，且 Sheet 展開時仍保留至少 84 CSS px 的圖面可視帶（票 05 的既有預算）。
- [x] 控制項順序、鍵盤焦點、下一題、結算與 screen-reader announcement 正確；一局暫停規則不變。
- [x] 不侵入自由看圖頁，且既有 quiz analytics／progress tests 與 viewport test seam 都通過。

## Validation

擴充 `tests/quiz-feedback.spec.ts`、`tests/quiz-page.spec.ts`、必要的 `tests/responsive-regressions.spec.ts` 與 `tests/quiz-play.ts` helper；跑 quiz progress／analytics 既有回歸。使用最長的現有符號名稱及含 confused-with 差異句的錯答，檢查兩個手機尺寸的結果／圖面／Sheet／動作列；以鍵盤、accessibility tree 與 reduced-motion 核對即時宣告與焦點。

## Comments

### 2026-10-01 — 配合新版品牌與房型色

- 對齊現行深碳灰結果區與房型色規則，補上 Quiz 自有高度預算、窄螢幕文字換行及 Sheet 開合的驗收。票 01–05 已完成，本票維持 ready；此更新不代表結果區已實作。

### 2026-10-01 — 實作與驗證

- `QuizRound` 在圖面與動作列之間顯示深碳灰結果區；答對有勾及題目名字，答錯同時顯示被點與正確符號。既有已掛載的 live status 宣告完整文字，結果區不另建重複的 live region。
- Quiz 自己量題目、結果與固定列的實際換行高度，限制 Sheet 的剩餘空間；CSS 保留 84px 圖面。320 × 568 使用較緊的垂直間距，只有總數的 Sheet 將出現次數放在標題旁，保留正文捲動空間。自由看圖的其他位置控制不變。
- 已走過 quiz feedback／page 與 responsive 回歸：判定、標記、暫停、下一題、完整名字宣告、鍵盤焦點和兩個手機尺寸的 Sheet 開合。Typecheck 通過；全套 progress／analytics、build 與跨頁視覺檢查併入票 07 的最後 gate。

### 2026-10-01 — Review 後補齊最長名稱

- Standards 軸無 actionable finding；Spec 軸指出最長名稱在 320 × 568 時正文不足兩行。票 07 的 regression gate 已補上該案例，並修正窄螢幕結果排列、標頭 metadata 與列距。完整 production suite 303 項通過，含 quiz progress／analytics；詳細量測與視覺紀錄見票 07。
