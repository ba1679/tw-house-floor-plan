# 01: Analytics gateway 與事件契約

**What to build:** 把 M5 的 GA4 基礎收成一個有型別、可停用、可測試的事件入口，完整宣告 M6 的事件名稱、參數與 enum。元件不得直接呼叫 `window.gtag`。

**Blocked by:** M5 的 GA4 script／measurement id／基礎 `symbol_view`（跨里程碑）

**Status:** resolved

規格：`../spec.md` 的「Analytics Decisions 2–4」「Testing Decisions」。

## 注意

- production id 不存在或 script 尚未 ready 時一律 no-op，不 throw、不排隊重送舊事件；台灣部署不以 consent 阻擋 GA。
- 測試提供 memory sink；正式實作與測試 sink 經過同一份 schema validation／型別。
- event 名、parameter key、enum value 只有一份；不要替每個元件各寫一個字串常數。
- 參數值只允許 primitive；`undefined` 欄位不送，不能被序列化成字串。
- 不新增 user/session id、timestamp、座標、完整進度或未知自由文字。
- 文件列出 GA 後台要登錄的 dimensions／metrics，但實際後台操作在票 07。

## Acceptance criteria

- [x] 有單一 analytics module／gateway；repo 其他地方沒有直接的 `window.gtag` 呼叫
- [x] `symbol_view`、`select_content`、`search`、`layout_interaction`、`info_sheet_action`、`quiz_start`、`quiz_answer`、`quiz_complete` 全部有型別契約
- [x] event 的必填參數漏掉、action enum 拼錯會 typecheck 失敗
- [x] 未設定 measurement id、gtag 未就緒兩種情況皆安全 no-op
- [x] browser test 可讀 memory sink，且不會真的送 Google request
- [x] 事件參數沒有任何自由物件、使用者／session id、timestamp、座標欄位
- [x] `npm run typecheck`、相關測試通過

## Comments

- Implemented in `lib/analytics/`: one discriminated TypeScript event contract,
  measurement-ID-gated GA bootstrap for the Taiwan deployment, and a test-only browser
  memory sink. Components do not call GA directly.
