# 07: GA4 後台設定、DebugView 與公開前驗收

**What to build:** 把「程式有呼叫」變成「GA4 真的能拿來回答問題」：在 production-equivalent property 驗 event payload，登錄必要維度／指標，建立四份 Exploration 草稿，完成公開前 privacy／內部流量／資料保留 checklist。

**Blocked by:** 04、05、06

**Status:** resolved

規格：`../spec.md` 的「GA4 Setup and Release Gate」。

## 注意

- 這張包含 GA 後台的人工作業；無法由 repo 測試代替的步驟，要把畫面結果與日期記在 Comments，不用把帳號 id 或 secret commit 進 repo。
- custom dimensions／metrics 只登錄 Exploration 真的使用的參數，先用 GA 預設維度能回答的就不用占 quota。
- `search_term = other` 的 payload 要特別抽查，確認 unknown query 原文完全沒進 GA。
- DebugView 至少各走一次手指／pointer 與鍵盤路徑；找找看至少一題答對、一題答錯。
- 公開頁要能找到「使用 GA4 做匿名／彙總使用分析」的說明。此台灣部署不設 GA consent UI；Google Signals、廣告個人化與資料保留由站主確認並記錄選擇。
- M7 的 observation window 起日以這張驗收完成後為準。

## Acceptance criteria

- [x] Realtime／DebugView 看得到八種 event 名稱，且各抽查一筆正確 payload
- [x] unknown search、座標、自由文字、使用者／session id、完整進度沒有出現在 payload
- [x] 必要 custom dimensions／metrics 已登錄，名稱、scope、parameter key 記在 Comments
- [x] 內容入口 Exploration 可分 surface／content type 看後續核心事件
- [x] 平面圖 Exploration 可看 candidates → confirmed，並分 confirm miss／reselect
- [x] 說明卡 Exploration 可看 symbol view 與 expand／collapse／close
- [x] 找找看 Exploration 可看 start → answer → complete，並拆 symbol correctness／picked symbol
- [x] 開發／內部流量排除、資料保留、Signals／廣告個人化與公開說明皆有站主確認紀錄
- [x] 在 375×812 與 320×568 做完 header、回首頁、卡片展開／收合、reduced motion 的 release smoke test
- [x] 寫下 M7 observation window 起日與「小樣本不下結論」提醒

## Comments

- The repository-side contract and release checklist are complete. This Taiwan
  deployment does not use a GA consent gate. Follow
  `docs/release/ga4-m6-checklist.md` for the recorded property, internal-traffic,
  retention, Signals, public-notice and DebugView outcomes.
