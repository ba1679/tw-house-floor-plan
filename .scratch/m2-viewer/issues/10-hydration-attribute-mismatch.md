# 10: 調查瀏覽器回報的 hydration 屬性不一致

**Status:** ready-for-agent
**Type:** bug
**Related:** 05（可點擊性提示）

## 問題

2026-09-08 使用者在 `/layouts/3b2l_standard` 回報 Console 警告：

> installHook.js:1 A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up.

尚未取得警告後面的 component stack 與屬性差異，根因未確認，未實作修正。

## 已做的調查

- 使用無擴充套件的 Playwright Chromium 連至現有 `next dev`，監聽 console error/warning 與 pageerror；首次載入和重新載入都沒有重現。
- `useFirstVisitHint` 的初始值固定為 `null`，localStorage 讀寫在 effect 內執行；目前沒有證據顯示本票由首次提示造成。
- 使用者 Chrome 分頁開著 DevTools，工具列顯示 5 個 errors；讀取完整 Console 前調查被中止，因此不能將這 5 個 errors 全部視為 hydration 錯誤。
- 使用者瀏覽器有擴充套件注入的 `grammarly-integration` 節點，但尚未證實與警告有關。`installHook.js` 的檔名本身也不足以判定根因。

## 驗收條件

- [ ] 取得完整 hydration 警告的 component stack、屬性 diff 與可重現條件。
- [ ] 確認差異來自應用程式、開發環境或瀏覽器擴充套件，再針對原因處理；不以全面 suppressHydrationWarning 掩蓋。
- [ ] 首訪、回訪與清除 localStorage 後載入皆無應用程式造成的 hydration 警告，首次提示行為保持正確。
- [ ] 若需修改程式，補上能重現該原因的回歸測試並驗證既有互動。
