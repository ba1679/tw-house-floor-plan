# 08: 修正 production GA4 指令佇列

**What to build:** 讓 `gtag` 將 `js`、`config` 與產品事件以 Google tag 可處理的 `arguments` 格式放入 `dataLayer`，並以瀏覽器測試鎖住這個邊界。

**Status:** release-verification-pending

## Acceptance criteria

- [x] 測試能在舊版佇列格式重現失敗，修正後通過
- [x] 本機 production build 送出 `page_view` 與 `symbol_view` 到 GA4 `/g/collect`
- [x] 既有 Analytics 測試通過
- [ ] 修正部署到公開 Vercel production URL 後，重新確認 `/g/collect` 與 GA4 Realtime／DebugView

## Comments

- 2026-10-04：公開站 `https://tw-house-floor-plan.vercel.app` 的 JavaScript 已包含 `G-V30D2J505B`，且載入 Google tag，但 `dataLayer` 中的 `js`、`config`、`symbol_view` 都是 Array，瀏覽器未送出 `/g/collect`。
- 在同一公開頁面用標準 `dataLayer.push(arguments)` 補送 `js` 與 `config`，立即出現 `page_view` 的 `/g/collect`，HTTP 204；可排除環境變數未進 bundle。
- 改用 `arguments` 後，從 `origin/main` 建出的本機 production build 已送出 `page_view` 和 `symbol_view`，兩者的 `/g/collect` 都收到 HTTP 204；`tests/analytics-bootstrap.spec.ts` 先紅後綠，Analytics 測試共 10 項通過。公開站尚未部署此修正。
