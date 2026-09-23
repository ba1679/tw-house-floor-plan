# 06: 找找看漏斗事件

**What to build:** 找找看從開始一局、逐題作答、主動看說明到完成結算都有可去重的事件，能計算完成率、單一符號正確率與最常見的誤認組合。

**Blocked by:** 01

**Status:** resolved

規格：`../spec.md` 的「Analytics Decisions 3（quiz_* 與 quiz_sheet symbol_view）」。

## 注意

- `quiz_start` 在成功建立一局後送；第一次 `start_type = first`，再玩一次是 `replay`。
- `quiz_answer` 只在 `answers.length` 增加時送。第一段、重選、第二段 miss、看說明、下一題都不得多送。
- target 是 `symbol_id`，被點到的是 `picked_symbol_id`；答對時兩者相同。`hotspot_id` 是實際點到的一處。
- input method 區分 touch/pointer 與 keyboard，但不記按鍵或座標。
- `quiz_complete` 只在進 finished 的轉移送一次；重繪結算畫面不重送。
- 答後圖上 reveal 不算 `symbol_view`；使用者每次明確按「看說明」且卡片從關閉變開啟才算一筆 `quiz_sheet`。同一次開啟期間的 rerender 不重送；關閉後再按一次是新的閱讀，應再送一筆。
- 不送 abandon；complete ÷ start 即完成率。

## Acceptance criteria

- [x] 第一次開始與再玩一次各送一次 quiz_start，start type 與 question count 正確
- [x] 每一題只送一筆 quiz_answer；第一段、miss、reselect、next 都不多送
- [x] 手指與鍵盤答案 payload 的 target／picked／hotspot／correct／index／input method 正確
- [x] 7 題一局只送一筆 quiz_complete，correct count 與畫面結算相同
- [x] 答後只 reveal 不送 symbol_view；每次明確按「看說明」開卡送一筆 `quiz_sheet`
- [x] 關閉再開同一題卡片算第二次明確閱讀；同一次開啟期間的 rerender 不雙送，兩條規則都有測試
- [x] payload 不含整份 questions、answers、localStorage progress 或任意使用者識別
- [x] 既有 quiz flow、progress、keyboard、feedback 測試維持綠

## Comments

- Quiz start, answer and completion are derived from round-state transitions.
  A quiz-sheet view is emitted only for an explicit 「看說明」 action, never for
  answer reveal or an auto-opened wrong-answer sheet.
