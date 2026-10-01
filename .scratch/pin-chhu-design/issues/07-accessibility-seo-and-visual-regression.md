# 07 — 拼厝跨頁可及性、SEO 與視覺回歸

Status: resolved
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

- [x] 每個主要頁面在 375 × 812 可讀可操作；layout／quiz 在 320 × 568 沒有 document scroll 或水平捲動。
- [x] full／compact mark、中文／羅馬字、focus ring、InfoSheet、State、結果區在鍵盤與輔助技術下都有正確可見／可聽訊號。
- [x] 圖面／State 的對比與灰階可辨性、答對／答錯的非紅綠表達、reduced-motion 都受保護。
- [x] 主臥、客廳、餐廳／廚房、衛浴／陽台的填色符合核准配對，其他房型維持中性；首頁縮圖與互動頁一致，資料 JSON 與符號圖形未因配色修改。
- [x] normal／candidate／selected／highlighted／revealed 與鍵盤焦點在房型底色及暗化面上可辨；保留對 `--fp-paper`／`--fp-wall` 的既有對比 contract，選取線、角標、勾與白襯邊不被房間色吞掉。
- [x] `npm run generate:brand` 可重現已提交的 favicon／Apple icon／OG 產物；full／compact 均使用共享 BrandMark 與新色票，compact 在小尺寸清楚，參考圖的棋盤背景未進入產物。
- [x] 搜尋可見 copy 仍含平面圖用途，metadata／Structured Data／noindex／sitemap／analytics 均通過現有 contract tests。
- [x] `npm run validate`、`npm run validate:floorplan`、全套 tests 和 `npm run build` 通過。

## Validation

先檢查 `tests/design-language.spec.ts`、`tests/floorplan-renderer.spec.ts`、`tests/site-header.spec.ts` 與票 06 的 quiz／responsive coverage，補上未覆蓋的跨頁行為，再跑全套 tests 與 build。人工目視 375 × 812、320 × 568 與 desktop 的品牌資產、四組房型色、State 彩色／灰階及 Sheet 開合，記錄 browser／viewport 與任何已知系統字差異；另核對 React 與離線 SVG renderer 的房型配對。

## Comments

### 2026-10-01 — 新配色的回歸範圍

- 補上房型色、暗化／還原、彩色房間上的 State 可辨性與品牌資產可重現檢查。沿用票 01–05 已建立的 coverage，等票 06 完成後驗收完整結果區與高度預算；本票維持 ready 並保留對票 06 的依賴。

### 2026-10-01 — 跨頁回歸與完成 gate

- 新增 `tests/pin-chhu-regressions.spec.ts`：首頁縮圖／自由看圖／找找看的 12 間房填色一致；CLI 離線 SVG 與 React 配對一致；所有房型暗化及關卡還原；共享 BrandMark 的 full／compact、深淺表面與 16px fallback；最長名字「出入口（無門扇）」答成「推拉門」的完整回饋、accessibility tree、reduced-motion、鍵盤焦點與下一題。
- 兩軸 review 的唯一 Spec finding 已修正：320 × 568 的長名稱會額外占用結果與 Sheet 標頭高度。矮螢幕將判定與被點名字合成第一行、正確答案獨立一行，總數與分類並排、名稱自己一行，保留至少 84px 圖面及 48px 可捲正文。一般單開門含差異句的答對／答錯、展開／收合／關卡亦受 responsive tests 保護。
- `tests/design-language.spec.ts` 補上房型底色與暗化面的實際瀏覽器色彩對比及黑白焦點。原 State 藍／暖線對暖陶土約為 2.98／2.92:1，原暗化面的符號線約為 2.81:1；僅調整既有 State 明度與房間暗化權重，使 State／符號線達 3:1、房名達 4.5:1。色相、形狀、品牌配對、牆柱／文字／符號線的既有色值保持。理由已補入 `DESIGN.md`，值集中於 CSS。
- `PORT=3100 npx playwright test --workers=4`：**303 passed**（production SSG build 產物，含 analytics、progress、metadata、canonical、JSON-LD、robots／sitemap 與 quiz noindex）。該路徑完成 `generate:brand`、`validate`、`validate:floorplan` 與 `npm run build`。`npm run typecheck` 通過；`npm run test:domain`：**13 passed**。
- 重新執行 `npm run generate:brand`，favicon SVG、Apple icon PNG、OG SVG 的前後 SHA-256 全部一致。`data/` 的 FloorPlan JSON 與符號圖形未修改。
- 目視：Chromium 的 375 × 812（首頁／分類／符號／答錯）、320 × 568（最長名稱的答對／答錯）、1280 × 900（首頁／自由看圖 Sheet／答對），另並排檢查 normal／candidate／selected／highlighted／revealed 的彩色與灰階畫面。截圖位於 `/tmp/pin-chhu-qa/`；使用現有 dev preview，其 Next.js 開發指示器不是 production 介面。Apple icon 亦已目視核對。硬體 Safari／iPhone／Android 與實際螢幕閱讀器發聲未測，本次證據為 Chromium viewport、既有 CDP touch 測試、鍵盤與 accessibility tree。

### 2026-10-01 — 最終 review 與 knowledge update

- Standards：0 hard breaches、0 未解決 smell；原先重複的瀏覽器色彩轉換已收進 `tests/browser-colors.ts`，三處共用，複查通過。整理後重新跑 design-language／pin-chhu-regressions 的 production gate：**14 passed**。
- Spec：0 findings。另獨立重測最長名稱的 320 × 568 答錯／展開／收合，圖面 84px、正文約 50.6px、document 568px；關卡焦點與下一題焦點正確。
- ADR-0003 追加找找看可視帶歸零限制已解決的紀錄，保留 InfoSheet 作為版面列，以及高度預算由 QuizRound 管理的既有邊界。
