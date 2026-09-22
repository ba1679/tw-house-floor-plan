# 12: CI 與 production release gate

**What to build:** 讓每個 pull request 與 main 都自動走完 M5 的程式、內容與 Lighthouse gate，並留下可照著完成的 production smoke 與 GA4 管理設定清單，使階段一上線不再依賴記憶。

**Blocked by:** 07 / 啟用 80% 內容發布 gate；11 / 本機 Lighthouse 發布稽核

**Status:** release-verification-pending

- [x] GitHub Actions 在 pull request 與 main 使用 lockfile 安裝依賴，並依序執行 typecheck、build-time validation、production build、Playwright、Lighthouse
- [x] 任一 validator、瀏覽器測試或 Lighthouse assertion 失敗都讓 workflow 失敗；不把錯誤降成 warning
- [x] Workflow 不自動修改或重新建立 Vercel 專案，也不加入自訂網域工作
- [x] CI 使用與本機相同的 Playwright 與 Lighthouse 設定，不另抄一份頁面清單或門檻
- [x] 發布 checklist 包含 GA4 Measurement ID、Consent Mode 指令順序、廣告相關 consent denied、未串 Google Ads、event-level retention 2 個月
- [x] 發布 checklist 包含 GA4 Realtime／DebugView 的 `symbol_view` smoke，並確認 payload 沒有 query、姓名、帳號或學習進度
- [ ] 對既有公開 Vercel production URL 做非破壞性 smoke：五種代表頁、robots、sitemap、OG 圖、favicon、Apple touch icon 與適用 JSON-LD 可取得
- [ ] Production canonical host 使用現有 Vercel URL，不等待自訂網域；日後換 host 被明記為另一次 canonical migration
- [x] 更新 PRD：階段一完整體驗以看得到畫面的使用者為目標，既有鍵盤／ARIA 必須保留，但不宣稱完成完整 screen-reader 或 WCAG 驗證
- [ ] 最終完整 workflow 綠燈、真資料查證率至少 12/14，且 M5 spec 的發布完成定義逐項有可核對結果

## Comments

- 2026-09-22：repo 內實作與本機 gate 已完成於 `5181c38`；`npm run typecheck`、`npm test`（266 passed）、`npm run audit` 與 14/14 內容查證皆通過。
- 已確認既有 production host 為 `https://tw-house-floor-plan.vercel.app`；目前仍是 M5 前的 production commit，尚不能作為 M5 smoke 證據。
- 2026-09-22：已在 Vercel Production 設定 `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-V30D2J505B`；Vercel 顯示需下一次 deployment 才會生效。
- 待完成：把 branch 推到遠端取得 PR／main workflow 綠燈；部署後確認 production metadata 並執行公開站 smoke；在 GA4 Realtime／DebugView 與管理介面確認事件、Measurement ID、Google Ads 未連結及 retention 2 個月。
