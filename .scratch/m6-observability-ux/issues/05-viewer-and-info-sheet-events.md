# 05: 平面圖與說明卡事件

**What to build:** 從真實的 viewer state transition 量兩段式候選、確認、失敗、重選、回全圖與是否使用手動 pan／zoom；說明卡量展開、收合、關閉與其他位置。

**Blocked by:** 01、03

**Status:** resolved

規格：`../spec.md` 的「Analytics Decisions 3（layout_interaction／info_sheet_action／symbol_view）」。

## 注意

- 事件依 reducer 前後狀態判斷，不在原始 pointer/touch handler 看到 event 就送。
- `candidates_shown` 只在真的從 browsing 進 candidates 時送；空白第一下、double tap 的第一下不算。
- `symbol_confirmed` 在手指第二段與鍵盤直接選定各送一次，帶正確 input method。
- `confirm_missed` 是第二段沒命中；第一段附近沒有 hotspot 不是同一件事。
- `manual_pan`／`manual_zoom` 每次 viewer mount 各最多一次，不追距離、倍率與每幀。
- InfoSheet open 由 `symbol_view` 表示；`info_sheet_action` 不再送 open。
- 自由看圖切其他位置後，同一張卡不再送第二次 `symbol_view`。

## Acceptance criteria

- [x] candidates、confirmed、confirm missed、reselect、reset view 都在真實狀態轉移時各送一次
- [x] confirmed payload 有 layout／symbol／hotspot／input method；candidate payload 的 count 正確
- [x] pointer/touch 相容事件不雙送；Strict Mode 不雙送
- [x] 一次連續拖曳／縮放與之後重複手勢，各 action 在本次 mount 仍只各一筆
- [x] 自由看圖 InfoSheet 第一次打開送 `symbol_view: layout_sheet`；換其他位置不重送
- [x] expand、collapse、close、next occurrence 送正確的 context／layout／symbol／action
- [x] 收合不是 close；×／Esc 是 close，事件語意與 UI 行為一致
- [x] 既有兩段式、pan/zoom、InfoSheet、keyboard 測試維持綠

## Comments

- Viewer events are derived from reducer before/after state. The per-mount pan
  and zoom flags prevent gesture-frame spam; InfoSheet owns the action callback
  seam while the layout owner supplies its typed context.
