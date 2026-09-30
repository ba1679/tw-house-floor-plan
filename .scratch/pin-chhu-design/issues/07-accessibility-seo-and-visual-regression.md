# 07 — 拼厝跨頁可及性、SEO 與視覺回歸

Status: ready
Blocked by: 03, 04, 05, 06

## Goal

以使用者可感知的 contract 驗證這次全面視覺更新：拼厝識別清楚、平面圖仍可靠、結果回饋明確，且搜尋／輔助技術／窄螢幕沒有退步。

## Scope

- 補齊或收斂跨頁 Playwright coverage，避免對 CSS module class 名稱與 React internal state 寫脆弱測試。
- 建立品牌資產、header identity、focus、文字對比、結果 live announcement、compact mark、全／小螢幕高度預算與無水平捲動的回歸檢查。
- 驗證 metadata、canonical、JSON-LD、robots、sitemap、quiz noindex、`symbol_view` 與既有資料 validation。

## Constraints

- 測試以可見行為、可存取名稱、資料語意、真瀏覽器高度與 route contract 為準，不 snapshot compiled class names。
- 視覺檢查可記錄截圖，但不可因像素微差阻止合理的系統字 rendering。
- 不以這張票修改 design direction 或引入新功能；遇到方向問題，回到對應 implementation ticket 或 `DESIGN.md`。

## Acceptance criteria

- [ ] 每個主要頁面在 375 × 812 可讀可操作；layout／quiz 在 320 × 568 沒有 document scroll 或水平捲動。
- [ ] full／compact mark、中文／羅馬字、focus ring、InfoSheet、State、結果區在鍵盤與輔助技術下都有正確可見／可聽訊號。
- [ ] 圖面／State 的對比與灰階可辨性、答對／答錯的非紅綠表達、reduced-motion 都受保護。
- [ ] 搜尋可見 copy 仍含平面圖用途，metadata／Structured Data／noindex／sitemap／analytics 均通過現有 contract tests。
- [ ] `npm run validate`、`npm run validate:floorplan`、全套 tests 和 `npm run build` 通過。

## Validation

跑所有現有 tests 加新增的跨頁 Playwright scenarios；人工目視 375 × 812、320 × 568 與 desktop，記錄 browser／viewport 與任何已知系統字差異。
