# 07 — 拼厝跨頁可及性、SEO 與視覺回歸

Status: ready
Blocked by: 03, 04, 05, 06

## Goal

以使用者可感知的 contract 驗證這次全面視覺更新：拼厝識別清楚、平面圖仍可靠、結果回饋明確，且搜尋／輔助技術／窄螢幕沒有退步。

## Scope

- 補齊或收斂跨頁 Playwright coverage，避免對 CSS module class 名稱與 React internal state 寫脆弱測試。
- 建立品牌資產、header identity、focus、文字對比、結果 live announcement、compact mark、全／小螢幕高度預算與無水平捲動的回歸檢查。
- 核對新版五色品牌資產與指定房型填色，涵蓋首頁縮圖、自由看圖與找找看；檢查 InfoSheet 開啟時各房色的暗化與關閉後還原，以及彩色／灰階下 State、房名與符號線的可辨識性。
- 驗證 metadata、canonical、JSON-LD、robots、sitemap、quiz noindex、`symbol_view` 與既有資料 validation。

## Constraints

- 測試以可見行為、可存取名稱、資料語意、真瀏覽器高度與 route contract 為準，不 snapshot compiled class names。
- 視覺檢查可記錄截圖，但不可因像素微差阻止合理的系統字 rendering。
- 不以這張票修改 design direction 或引入新功能；遇到方向問題，回到對應 implementation ticket 或 `DESIGN.md`。
- 色值以 `app/brand-tokens.css`／`app/globals.css` 為準。指定房型地板引用品牌色的例外已核准，不沿用舊的「所有房間只能中性灰」驗收；分類、Source Tier、正誤與 State 保持原本語意。
- 已有 header／品牌／圖面回歸可直接沿用；新增 coverage 聚焦跨房型填色、State 與暗化、票 06 結果區與 Sheet 同時顯示的缺口，不另建重複的 CSS token snapshot。

## Acceptance criteria

- [ ] 每個主要頁面在 375 × 812 可讀可操作；layout／quiz 在 320 × 568 沒有 document scroll 或水平捲動。
- [ ] full／compact mark、中文／羅馬字、focus ring、InfoSheet、State、結果區在鍵盤與輔助技術下都有正確可見／可聽訊號。
- [ ] 圖面／State 的對比與灰階可辨性、答對／答錯的非紅綠表達、reduced-motion 都受保護。
- [ ] 主臥、客廳、餐廳／廚房、衛浴／陽台的填色符合核准配對，其他房型維持中性；首頁縮圖與互動頁一致，資料 JSON 與符號圖形未因配色修改。
- [ ] normal／candidate／selected／highlighted／revealed 與鍵盤焦點在房型底色及暗化面上可辨；保留對 `--fp-paper`／`--fp-wall` 的既有對比 contract，選取線、角標、勾與白襯邊不被房間色吞掉。
- [ ] `npm run generate:brand` 可重現已提交的 favicon／Apple icon／OG 產物；full／compact 均使用共享 BrandMark 與新色票，compact 在小尺寸清楚，參考圖的棋盤背景未進入產物。
- [ ] 搜尋可見 copy 仍含平面圖用途，metadata／Structured Data／noindex／sitemap／analytics 均通過現有 contract tests。
- [ ] `npm run validate`、`npm run validate:floorplan`、全套 tests 和 `npm run build` 通過。

## Validation

先檢查 `tests/design-language.spec.ts`、`tests/floorplan-renderer.spec.ts`、`tests/site-header.spec.ts` 與票 06 的 quiz／responsive coverage，補上未覆蓋的跨頁行為，再跑全套 tests 與 build。人工目視 375 × 812、320 × 568 與 desktop 的品牌資產、四組房型色、State 彩色／灰階及 Sheet 開合，記錄 browser／viewport 與任何已知系統字差異；另核對 React 與離線 SVG renderer 的房型配對。

## Comments

### 2026-10-01 — 新配色的回歸範圍

- 補上房型色、暗化／還原、彩色房間上的 State 可辨性與品牌資產可重現檢查。沿用票 01–05 已建立的 coverage，等票 06 完成後驗收完整結果區與高度預算；本票維持 ready 並保留對票 06 的依賴。
