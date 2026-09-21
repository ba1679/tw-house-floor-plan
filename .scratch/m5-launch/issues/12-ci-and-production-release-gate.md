# 12: CI 與 production release gate

**What to build:** 讓每個 pull request 與 main 都自動走完 M5 的程式、內容與 Lighthouse gate，並留下可照著完成的 production smoke 與 GA4 管理設定清單，使階段一上線不再依賴記憶。

**Blocked by:** 07 / 啟用 80% 內容發布 gate；11 / 本機 Lighthouse 發布稽核

**Status:** ready-for-agent

- [ ] GitHub Actions 在 pull request 與 main 使用 lockfile 安裝依賴，並依序執行 typecheck、build-time validation、production build、Playwright、Lighthouse
- [ ] 任一 validator、瀏覽器測試或 Lighthouse assertion 失敗都讓 workflow 失敗；不把錯誤降成 warning
- [ ] Workflow 不自動修改或重新建立 Vercel 專案，也不加入自訂網域工作
- [ ] CI 使用與本機相同的 Playwright 與 Lighthouse 設定，不另抄一份頁面清單或門檻
- [ ] 發布 checklist 包含 GA4 Measurement ID、Consent Mode 指令順序、廣告相關 consent denied、未串 Google Ads、event-level retention 2 個月
- [ ] 發布 checklist 包含 GA4 Realtime／DebugView 的 `symbol_view` smoke，並確認 payload 沒有 query、姓名、帳號或學習進度
- [ ] 對既有公開 Vercel production URL 做非破壞性 smoke：五種代表頁、robots、sitemap、OG 圖、favicon、Apple touch icon 與適用 JSON-LD 可取得
- [ ] Production canonical host 使用現有 Vercel URL，不等待自訂網域；日後換 host 被明記為另一次 canonical migration
- [ ] 更新 PRD：階段一完整體驗以看得到畫面的使用者為目標，既有鍵盤／ARIA 必須保留，但不宣稱完成完整 screen-reader 或 WCAG 驗證
- [ ] 最終完整 workflow 綠燈、真資料查證率至少 12/14，且 M5 spec 的發布完成定義逐項有可核對結果
