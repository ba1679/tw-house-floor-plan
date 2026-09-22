# M5 上線品質、Analytics 與搜尋呈現

Status: release-verification-pending

來源：PRD `平面圖教學網站-PRD-Phase1.md` §5、§7.1、§9、§9.1、§10.1、§13（M1、M5）
決議依據：2026-09-20～2026-09-21 的 grill-with-docs；`CONTEXT.md` 的 Verification Status、符號瀏覽事件與入口來源；ADR-0001（不購買 CNS 11567）、ADR-0008（GA4 adapter）
既有實作：M2 檢視器、M3 符號／分類／搜尋頁、M4 找找看與學習進度；Next.js 靜態匯出已部署到可公開存取的 Vercel production URL

---

## Problem Statement

網站已經能公開打開，也已經有完整的看圖、符號頁、搜尋、分類與找找看流程，但「網址可用」不等於「可以宣告階段一上線」。目前有四個缺口：

第一，產品不知道使用者從哪個入口開始理解一個 Symbol（符號）。自由看圖、站內搜尋、分類瀏覽與找找看都可能讓人看到同一份解釋，但現在沒有一致的 `symbol_view`，也無法回答 PRD §9.1 想問的「哪一種入口最有效」。

第二，RWD、效能、SEO 與既有鍵盤／ARIA 行為只有零散測試，沒有一條能在每次合併時阻擋退步的發布 gate。現有 Playwright 只設 375 × 812 的 Chromium；沒有 Lighthouse、桌面代表尺寸或 CI workflow。一次看似無關的 CSS、metadata 或 client script 變更，可能直到部署後才被發現。

第三，搜尋與分享呈現仍不完整。現有頁面已有各自的 title、description、robots 與 sitemap，但沒有 canonical、Open Graph、favicon／Apple touch icon，也沒有 JSON-LD。社群分享與搜尋引擎只能自行猜測頁面的代表資訊。

第四，PRD 把內容查證率 ≥ 80% 定為上線門檻，但現況只有 1/14 = 7%。既有 validator 會印出門檻未達，卻仍以成功結束；它也只檢查 `verified_at` 等通用欄位，沒有強制各 Source Tier（來源層級）的證據條件。因此目前既不能達標，也能在沒有足夠證據時把資料字串改成 `verified` 而蒙混過關。

## Solution

把現有公開站補成一個有可觀測性、可重複驗收、可正確分享並且內容門檻真的會擋住發布的階段一產品。

全站用一個薄的 GA4 adapter 記錄 `symbol_view`。事件只在解釋內容真正呈現時送出：自由看圖與找找看以 InfoSheet 成功打開為準，符號頁以頁面內容成功載入為準；單純點擊、候選狀態、焦點移動與學習進度都不算。Consent Mode 先於 GA config 初始化；台灣階段一流量不因 modal 被阻擋，廣告相關 consent 一律拒絕，Measurement ID 缺席時整套 Analytics 安全地不載入、不送出。

發布品質由三條既有產品邊界驗收：build 後的真瀏覽器頁面、build-time 資料 validator、Lighthouse CLI。代表頁覆蓋首頁、平面圖、符號頁、分類頁與找找看；手機 375 × 812、桌面 1280 × 900，並以 320px 無水平溢出作為窄螢幕底線。Lighthouse mobile 每頁收集三次，以中位結果判斷；Performance、Accessibility、Best Practices、SEO 的適用項目皆須 ≥90。這些 gate 在本機有單一命令，也在 pull request 與 main 上執行。

所有可索引頁補上 canonical、Open Graph 與符合頁面真實內容的 JSON-LD；全站共用一張 1200 × 630 分享圖與同一個簡化平面圖線稿識別，延伸出 favicon 與 Apple touch icon。找找看維持 `noindex`，不加 JSON-LD，也不假裝成可獲得 rich result 的文章。

內容方面維持不購買 CNS 的既有決定。`verified` 的意思仍是「本站查證流程完成」，不是「核對過 CNS 原文」；validator 改為強制 tier-specific 結構條件並在查證率低於 80% 時失敗。以 14 筆計算，發布至少需要 12 筆完成：現有雨遮 1 筆，加上 4 筆透明揭露 `via` 的 CNS 轉載，再完成至少 7/9 筆 convention 的雙來源交叉核對即可達標。

## User Stories

1. As a 台灣首購族, I want 用目前公開的 Vercel 網址穩定打開網站, so that 我不用等待自訂網域也能開始使用
2. As a 手機使用者, I want 在 375 × 812 的螢幕完成看圖、讀說明與找找看, so that 我能在接待中心直接使用
3. As a 窄螢幕使用者, I want 320px 寬時頁面沒有水平捲動, so that 內容與控制元件不會被切到畫面外
4. As a 桌面使用者, I want 在 1280 × 900 下看到合理的版面與可操作的平面圖, so that 網站不只在手機尺寸成立
5. As a 使用者, I want 首頁、平面圖、符號頁、分類頁與找找看都維持可用, so that 上線品質工作不會破壞已完成的核心流程
6. As a 使用者, I want 頁面在行動裝置上快速且穩定地載入, so that 我不會在圖出現前離開
7. As a 鍵盤使用者, I want 既有的 Tab、Enter、空白鍵與 Esc 路徑繼續工作, so that M5 不會把已完成的操作方式改壞
8. As a 使用輔助科技的人, I want 既有的名稱、狀態列與 ARIA 關係不退步, so that 上線優化不會移除已經存在的語意
9. As a 從 Google 進站的人, I want 每一張可索引頁有符合內容的標題與描述, so that 我在點擊前知道頁面在講什麼
10. As a 從帶 query 的符號頁進站的人, I want 搜尋引擎只把乾淨網址視為 canonical, so that 同一份內容不會因入口參數分裂成多個網址
11. As a 在社群軟體貼連結的人, I want 預覽顯示正確的頁面標題、描述、網址與圖片, so that 收件人看得懂這個連結的內容
12. As a 回訪使用者, I want 瀏覽器分頁與書籤顯示可辨認的 favicon, so that 我能在多個分頁中找到這個網站
13. As a iPhone 使用者, I want 加到主畫面時有清楚的 Apple touch icon, so that 它不會只是一張模糊的頁面截圖
14. As a 搜尋引擎, I want 首頁以 `WebSite` 描述這個站, so that 我能理解這是一組相關的平面圖教學頁面
15. As a 搜尋引擎, I want 每張符號頁以 `DefinedTerm` 描述頁面真正解釋的 Symbol, so that 名稱與白話意思有明確語意
16. As a 搜尋引擎, I want 每張分類頁以 `CollectionPage` 描述頁面上實際列出的符號集合, so that 結構化資料和可見清單一致
17. As a 搜尋引擎, I want 每張平面圖頁以 `LearningResource` 描述它教人辨認什麼, so that 頁面的教學用途被正確表達
18. As a 搜尋引擎, I want 找找看維持 `noindex` 且沒有 JSON-LD, so that 隨機題目頁不會假裝成可索引內容
19. As a 站長, I want 結構化資料只描述頁面上真的看得到的內容, so that metadata 不會和頁面正文分岔
20. As a 站長, I want JSON-LD 被驗證為合法 JSON 且 URL 都指向 production base URL, so that 搜尋引擎不會收到 localhost 或壞掉的標記
21. As a 站長, I want 使用者真正看到 Symbol 解釋時收到一筆 `symbol_view`, so that 我能量到「開始理解」而不是「碰過介面」
22. As a 站長, I want 自由看圖只在 InfoSheet 成功打開後記錄, so that 第一段候選、點空白與失敗選取不會被誤算
23. As a 站長, I want 找找看只在題目 Symbol 的 InfoSheet 成功打開後記錄, so that 單純答題或只看到對錯不會被誤算成讀過解釋
24. As a 站長, I want 符號頁內容成功載入時記錄一次, so that 搜尋落地頁的閱讀入口也進入同一份分析
25. As a 站長, I want 同一次 InfoSheet 呈現只送一筆事件, so that React 重繪、ResizeObserver 或展開卡片不會重複計數
26. As a 站長, I want 關掉後再次打開同一個 Symbol 能再記一筆, so that 兩次獨立呈現不會被錯誤合併
27. As a 站長, I want 平面圖事件帶 `layout_id` 與實際 `hotspot_id`, so that 我能知道使用者在哪張圖、哪一處開始讀
28. As a 站長, I want 找找看事件帶 `layout_id` 與觸發說明的實際 `hotspot_id`, so that 我能重建答錯時使用者點到了哪裡
29. As a 站長, I want 找找看答錯時 `symbol_id` 仍是 InfoSheet 顯示的題目 Symbol, so that 事件代表被閱讀的內容而不是被誤點的 Symbol
30. As a 站長, I want 找找看答錯時允許 `symbol_id` 與 `hotspot_id` 指向不同 Symbol, so that 事件忠實表達既有的答錯流程
31. As a 站長, I want 不另外送 `picked_symbol_id`, so that 最小事件仍可由 FloorPlan 資料還原且不複製事實
32. As a 站長, I want 從站內搜尋進符號頁時 `source` 是 `search`, so that 我能辨認搜尋入口
33. As a 站長, I want 從分類清單進符號頁時 `source` 是 `category`, so that 我能辨認分類入口
34. As a 站長, I want 自由看圖與找找看分別送 `layout`、`quiz`, so that 四種產品入口可以直接比較
35. As a 站長, I want `source` 不被外部 referrer 或 Source Tier 混用, so that 分析欄位只有一個穩定意思
36. As a 使用者, I want Analytics 不收姓名、帳號、搜尋文字或我的熟悉度, so that 產品分析維持最小資料範圍
37. As a 使用者, I want Google 廣告儲存、廣告使用者資料與廣告個人化保持拒絕, so that 這個沒有廣告的教學站不開啟不需要的用途
38. As a 台灣使用者, I want 階段一瀏覽不被 consent modal 攔住, so that 我可以直接開始看圖
39. As a 未來維護者, I want Consent Mode 的 default 與 update 路徑集中在 Analytics 邊界, so that 日後受眾擴張時能加入地區或 consent UI 而不改每個事件呼叫點
40. As a 開發者, I want Measurement ID 沒設定時 Analytics 成為 no-op, so that 本機、測試與 preview 不會污染 production 資料
41. As a 站長, I want GA4 event-level 資料保留採可用的最短期間, so that 分析需求不造成不必要的長期保存
42. As a 開發者, I want `symbol_view` 只有一個 typed adapter contract, so that GA4 API 不會散落在頁面、檢視器與找找看元件
43. As a 開發者, I want 在 build 後的真瀏覽器觀察送出的事件, so that 測試涵蓋頁面、互動與 provider 邊界而不是只測 helper
44. As a 開發者, I want 一個本機 audit 命令重現 CI 的 Lighthouse gate, so that 我能在送出 PR 前修掉退步
45. As a 維護者, I want pull request 與 main 自動跑 typecheck、build、既有瀏覽器測試與 Lighthouse, so that 退步不能靠記得手動檢查
46. As a 維護者, I want Lighthouse mobile 對每張代表頁收集三次並以中位結果判斷, so that 單次環境抖動不會任意擋住發布
47. As a 維護者, I want 適用頁面的 Performance、Accessibility、Best Practices、SEO 都至少 90, so that 「各項達標」有明確且可重複的數字
48. As a 維護者, I want 找找看的 SEO 不因刻意 `noindex` 被當成產品缺陷, so that 正確的索引策略不會和 Lighthouse gate 自相矛盾
49. As a 維護者, I want 首頁、平面圖、符號頁、分類頁與找找看都有 RWD 代表案例, so that 五種頁面形狀至少各被走過一次
50. As a 內容維護者, I want `verified` 仍表示本站查證流程完成, so that 不購買 CNS 不會讓查證狀態永遠停在 `partial`
51. As a 讀者, I want CNS 轉載的出處明寫 `via` 與未核對原文, so that 我不會誤以為網站直接看過 CNS
52. As a 讀者, I want convention 至少有兩份彼此獨立的可信出處, so that 「業界慣例」不是只靠單一文件宣告
53. As a 讀者, I want regulation 至少指向官方法規出處, so that 法規主張可以回到正式來源查閱
54. As a 維護者, I want 每筆 `verified` 都有日期與查證者, so that 日後知道資料有多舊、該找誰確認
55. As a 維護者, I want 查證率低於 12/14 時 validator 非零結束, so that 80% 真的是上線 gate 而不是報告文字
56. As a 維護者, I want validator 分別說出缺的是 `via`、第二份出處、官方法規、日期或查證者, so that 我能修資料而不是猜規則
57. As a 規格維護者, I want PRD 明載階段一完整體驗以看得到畫面的使用者為目標, so that 無障礙承諾與目前實際範圍一致
58. As a 規格維護者, I want 既有鍵盤與 ARIA 能力仍被視為必須保留, so that 限縮目標受眾不會被解讀成可以刪除已完成的無障礙功能
59. As a 發布者, I want production smoke check 確認 canonical、sitemap、robots、分享圖與圖示都能從公開網址取得, so that 本機通過不會掩蓋部署設定問題
60. As a 發布者, I want M5 不依賴購買 CNS 或申請自訂網域, so that 已接受的範圍決定不會在最後一哩被重新打開

## Implementation Decisions

### Analytics contract 與觸發時機

- 建立單一、薄的 GA4 adapter。產品端只認得 `symbol_view` 與其 payload，不直接呼叫 `gtag`，也不讓 GA 的 queue、script lifecycle 或 consent command 滲入頁面元件
- `symbol_view` payload 固定包含 `symbol_id` 與 `source`；`source` 只能是 `layout`、`search`、`quiz`、`category`
- `source = layout | quiz` 時 `layout_id` 必填；這兩條互動路徑也帶 `hotspot_id`
- 自由看圖在 InfoSheet 從關閉變為成功呈現時送事件。第一段候選、第二段未命中、網址高亮、樑的缺席橫幅、切換 occurrence 與展開同一張卡都不送
- 找找看只有在 InfoSheet 成功呈現時送事件：答錯自動開卡會送；答對但沒有按「看說明」不送；答對後按「看說明」才送。`symbol_id` 是題目 Symbol，`hotspot_id` 是實際選定熱區，因此兩者可不一致
- InfoSheet 本身不決定 `source` 或事件 payload。自由看圖與找找看各自在知道完整情境的父層呼叫 adapter，避免把 layout／quiz 判斷塞進共用呈現元件
- 符號頁在 client hydration 後送一次事件。分類清單連結帶 `?from=category`；站內搜尋結果帶 `?from=search`。缺少或帶非法 `from` 的乾淨符號頁以 `search` 記錄，因為 Symbol 頁在本產品裡就是搜尋落地入口；這是產品入口分類，不是外部 referrer 歸因
- query 只影響 Analytics 入口來源；canonical 與 Open Graph URL 永遠使用不含 query 的 Symbol URL
- 同一次卡片或頁面呈現只送一筆。關閉卡片再重新打開是新的一次呈現，可以再送；React re-render、卡片展開、ResizeObserver、視野 resize 不是新呈現
- 不送姓名、帳號、自由文字、站內搜尋 query、熟悉度、答對／答錯次數、完整進度或外部 referrer。找找看的被點 Symbol 不另送 `picked_symbol_id`，需要時以 `layout_id + hotspot_id` 回查 FloorPlan

### GA4 載入、Consent Mode 與管理設定

- Analytics 由公開環境設定中的 GA4 Measurement ID 啟用；缺席或格式不合法時 script 不載入、adapter 安全 no-op。preview、測試與本機預設不送 production Analytics
- Consent Mode v2 的 default command 必須在 GA config 與任何 event 之前。台灣階段一流量的 `analytics_storage` 為 `granted`，不顯示 modal、不等待互動；非台灣的 fallback 為 `denied`，保留日後接 consent UI 的 update seam
- `ad_storage`、`ad_user_data`、`ad_personalization` 一律為 `denied`；本階段不串 Google Ads、不啟用廣告個人化
- Consent default、GA config、page lifecycle 與 event queue 都由同一個 Analytics 邊界管理，頁面只能呼叫產品事件 adapter
- GA4 property 的 event-level data retention 設為 2 個月，作為部署 checklist 的人工可驗證設定；這是 GA 管理介面設定，不假裝能由 repo 內測試保證
- 這份規格描述產品選擇，不宣稱它替代法律意見。若受眾或服務地區超出台灣，必須重新檢視 consent UI、地區 default 與隱私揭露

### Metadata、Open Graph、JSON-LD 與識別資產

- production base URL 沿用現有 `SITE_URL` 優先、Vercel production URL 次之的單一來源；不新增自訂網域依賴。production metadata 不得輸出 localhost
- 所有可索引頁都有絕對 canonical：首頁、每張平面圖、每張符號頁、每張分類頁。query 不進 canonical
- 所有頁面沿用既有的 page-specific title 與 description，並補上 Open Graph title、description、type、URL、site name、locale 與共用圖片。內容仍由既有資料與集中文案產生，不另外維護第二份頁面標題
- 全站只製作一張 1200 × 630 Open Graph 圖，不做每個 Symbol 一張的圖片 pipeline。圖像使用簡化的平面圖線稿識別，不冒充任何特定建案格局
- favicon、Apple touch icon 與 Open Graph 圖共享同一個簡化視覺識別；favicon 必須在小尺寸仍可辨認，不直接縮小完整平面圖
- JSON-LD 用一個集中、可序列化的 helper 產生，頁面只傳本來就擁有的資料與 canonical URL。JSON-LD 不複製 Symbol、分類或 FloorPlan 名單
- 首頁輸出 `WebSite`，至少包含 name、description、url、inLanguage
- Symbol 頁輸出 `DefinedTerm`，至少包含 name、description、url、inDefinedTermSet 或所屬站點關係；資料來自該 Symbol 的正式名稱、白話意思與 canonical
- 分類頁輸出 `CollectionPage`，並以頁面實際列出的 Symbol 建立 `mainEntity`／`hasPart` 或等價集合關係；項目數與順序由同一份分類資料產生
- 平面圖頁輸出 `LearningResource`，描述名稱、說明、URL、語言、免費存取、教育用途與它教人辨認的內容；不得宣稱課程、證照或網站沒有提供的學習成果
- 找找看頁維持 `noindex`、不進 sitemap、不輸出 JSON-LD。它仍可有基本 Open Graph metadata，但 canonical 不應讓它變成可索引內容
- 不使用 `Article`、評分、FAQ 或其他頁面上不存在的結構化內容。Schema.org 型別能幫助機器理解，不承諾 Google rich result

### RWD、Lighthouse 與 CI gate

- 代表頁固定為：首頁、一張平面圖、一張 Symbol、一張分類、一張找找看。動態頁代表案例使用真資料中存在的 id，不新增專用 fixture 頁
- RWD 驗收尺寸：手機 375 × 812、桌面 1280 × 900；另以 320px 寬檢查整頁 `scrollWidth <= clientWidth`
- RWD 測試驗證外部行為與關鍵幾何：主要標題和主要入口可見、平面圖框有正尺寸、InfoSheet 可開關、找找看可開始、沒有水平溢出。不得以整頁像素截圖鎖死所有視覺細節
- Lighthouse 使用 mobile 模擬，在本機 build 後的靜態站執行；代表頁每頁收集三次，以 Lighthouse CI 選出的中位結果做 assertions
- 可索引的首頁、平面圖、Symbol、分類頁要求 Performance、Accessibility、Best Practices、SEO 全部 ≥0.90
- 找找看要求 Performance、Accessibility、Best Practices ≥0.90；SEO category 不作分數 gate，因為頁面刻意 `noindex`。`noindex` 與不進 sitemap 由既有頁面測試繼續保證
- 提供單一 `npm run audit` 本機命令，負責對 build 產物啟動／連接靜態伺服器並執行同一份 Lighthouse 設定；不要求開發者手動依序輸入多個命令
- 新增 GitHub Actions workflow，於 pull request 與 main 執行 locked install、typecheck、build-time validation、Playwright 與 Lighthouse。任何 gate 失敗即失敗，不自動部署、不改 Vercel 專案設定
- production URL 已由使用者人工確認可用；M5 完成時再做一輪非破壞性的 production smoke check，確認公開資產與 metadata，不把 live 網路效能當成可重現的 CI 分數來源

### 無障礙範圍

- 階段一完整體驗的目標受眾限縮為看得到畫面的使用者；找找看考的是視覺辨識，不承諾完全看不見畫面的使用者能有等價遊玩體驗
- 這個限縮不得刪除既有的鍵盤路徑、可存取名稱、焦點管理、status live region、HTML landmarks 或其他已完成能力；既有回歸測試照常是 gate
- M5 不新增 axe、VoiceOver／NVDA 人工驗收、WCAG conformance 聲明或完整 screen-reader audit
- Lighthouse Accessibility ≥90 是自動化低成本 gate，不等同 WCAG 合規或人工無障礙認證
- PRD 的受眾與無障礙段落要隨 M5 knowledge update 改成上述範圍，避免規格繼續承諾本階段不會驗收的完整體驗

### 內容查證與發布門檻

- 維持 ADR-0001：不購買 CNS 11567。`verification_status = verified` 表示本站定義的查證流程完成，與 `source_tier` 是兩條不同的軸
- 通用條件維持 `plain_meaning`、至少一筆 `source_refs`、`verified_at`、`verified_by` 非空；`caution` 不屬於查證完備性
- `source_tier = cns` 且標記 `verified` 時，至少一筆出處要有非空 `via`，明載透過哪份文件轉載且未核對 CNS 原文
- `source_tier = convention` 且標記 `verified` 時，至少要有兩筆 `doc` 不同的出處。validator 只能保證結構上是兩份不同文件；「彼此獨立且可信」仍由內容查證者人工確認並以 `verified_by` 負責
- `source_tier = regulation` 且標記 `verified` 時，至少一筆出處要有可解析的 HTTPS URL 與定位資訊；內容查證者人工確認它是官方法規來源
- 當 `verified / symbols < 0.8` 時 validator 加入 error 並非零結束。14 筆的門檻是至少 12 筆，不使用四捨五入把 11/14 = 78.6% 算成通過
- 現況 1/14。4 筆 CNS 轉載可在修正公會表 14 的定位、確認 `via`、填日期與查證者後完成；它們證明的是轉載鏈，不宣稱 CNS 原文正確
- 9 筆 convention 各補一份真正獨立、可取得且實際讀過的第二來源。為達 12/14，至少完成其中 7 筆；目標仍是 9 筆全部完成，不把 80% 當停止研究的理由
- 公會 PDF 的根網址與同一份 PDF 的不同頁不是兩份獨立來源；搜尋結果摘要也不是已讀過的出處
- validator 的錯誤訊息必須帶 Symbol id、違反的 tier-specific 條件與修正方向；警告與門檻不足不得再共用成功 exit code

### 發布完成定義

- 公開 Vercel production URL 可開啟五種代表頁，且沒有因 metadata／Analytics script 新增而破壞靜態匯出
- CI 在 PR 與 main 上通過；本機 `npm run audit` 可重現 Lighthouse assertions
- 查證率至少 12/14，tier-specific validator 全部通過
- GA4 Realtime／DebugView 人工 smoke 能看到一筆正確的 `symbol_view`，且確認沒有 query、姓名、帳號或學習進度欄位
- GA4 管理設定人工確認 event-level retention 為 2 個月，未串 Google Ads，廣告相關 consent 預設為 denied
- production HTML／HTTP 可取得 canonical、Open Graph 圖、favicon、Apple touch icon、robots、sitemap 與適用頁面的 JSON-LD
- 不等待自訂網域；Vercel 網址就是階段一 canonical host，日後若加網域需另做 canonical migration

## Testing Decisions

**什麼是好的測試**：只測外部可觀察行為與發布邊界——使用者能不能完成流程、建置產物宣告了什麼 metadata、Analytics 邊界收到什麼事件、validator 是否阻擋不合格資料、Lighthouse command 是否達到門檻。不測 React state、effect 次數、helper 的私有物件形狀或 CSS class 名稱。

**四條 seam；前三條沿用既有邊界，第四條是 M5 本身的發布工具邊界：**

**① build 後真瀏覽器／靜態 HTML（主要）**——沿用現有 Playwright webServer 直接測 `next build` 的輸出。頁面內容、query canonical、JSON-LD、Open Graph、圖示連結、RWD、鍵盤回歸與 Analytics 互動都走這條；不另外建立元件測試框架。

- Analytics 測試在頁面載入前提供可觀察的 GA queue／adapter 邊界，阻止實際網路送往 Google；斷言事件名稱、payload、順序與去重。它測的是「頁面真的送了什麼」，不是直接呼叫 adapter 自己證明自己
- 靜態 metadata 優先讀 build 產物，沿用既有 title／description／sitemap 測試手法；只有需要 hydration、互動或幾何尺寸時才開瀏覽器
- RWD 在單一代表案例中切換 viewport，不新增 desktop project 去把整套既有行動測試重跑一遍

**② build-time 資料 validator**——沿用現有 temp sandbox：複製資料與 validator，逐一造出缺 `via`、只有一份 convention 出處、regulation 無 URL、缺日期／查證者、11/14 與 12/14 等案例，斷言 exit code 與具體錯誤訊息。真資料通過只是 baseline，不能取代壞資料案例。

**③ 既有鍵盤／ARIA 回歸**——沿用現有 Playwright 覆蓋，不新增 axe 或 screen-reader runner。Analytics、metadata 與 RWD 修改後，既有自由看圖與找找看的鍵盤、焦點、名稱、status 測試必須原樣通過。

**④ Lighthouse CLI**——以正式 build 產物為受測者，三次收集、中位 assertion；CI 與本機共用同一份設定。Lighthouse 分數本身不在 Playwright 裡重做，避免兩套 gate 漂移。

**必須涵蓋的案例：**

1. Measurement ID 缺席時沒有 GA script、沒有外送 request、核心頁面與互動照常工作
2. Consent default 在 config／event 前；台灣 analytics storage 為 granted，三個廣告相關 consent 為 denied
3. 自由看圖第一段、點空白、第二段未命中不送事件；InfoSheet 成功打開才送一筆 `symbol_view`
4. 自由看圖事件包含 `source=layout`、正確 `layout_id`、`symbol_id`、`hotspot_id`
5. 同一張 InfoSheet 展開、resize、切換 occurrence 不重送；關閉後重開會再送
6. 找找看答對後不按「看說明」不送；按下後送 `source=quiz`
7. 找找看答錯自動開卡時送一筆；`symbol_id` 是題目、`hotspot_id` 是被選定熱區，兩者可指向不同 Symbol
8. Symbol 乾淨 URL 載入送一筆 `source=search`；`?from=search` 同樣是 search；`?from=category` 是 category；非法值不進事件
9. 站內搜尋結果 href 帶 `from=search`，分類清單 href 帶 `from=category`；兩者落地 canonical 都不含 query
10. payload 不含搜尋 query、referrer、學習進度、答對／答錯數、姓名、帳號或自由文字
11. 首頁、平面圖、Symbol、分類的 build HTML 各有唯一且絕對的 canonical，host 不是 localhost（production fixture）
12. 每張代表頁的 Open Graph title、description、URL 與既有 title／description 同源，圖片是絕對 1200 × 630 URL
13. favicon 與 Apple touch icon 存在於 build／public 產物，metadata 指得到，production URL 回 200
14. 首頁 JSON-LD 是合法的 `WebSite`；值與頁面及 production URL 一致
15. 每一張 Symbol 頁 JSON-LD 是合法的 `DefinedTerm`；name／description／url 對應自己的資料，不是共用模板殘值
16. 每一張分類頁 JSON-LD 是 `CollectionPage`；列出的 Symbol 集合與畫面清單一個不多、一個不少
17. 每一張平面圖頁 JSON-LD 是 `LearningResource`；名稱與 URL 對應自己的 FloorPlan
18. 找找看維持 `noindex`、不進 sitemap、沒有 JSON-LD
19. JSON-LD 不輸出 `Article`、rating、FAQ 或頁面不存在的欄位
20. 375 × 812 下五張代表頁主要內容可見、互動入口可用；平面圖框有正尺寸，InfoSheet 可開關，找找看可開始
21. 1280 × 900 下五張代表頁沒有手機版固定尺寸造成的斷裂，平面圖與主要內容仍可操作
22. 320px 下五張代表頁 `scrollWidth <= clientWidth`
23. 既有鍵盤、ARIA、焦點與 status 測試全數通過
24. verified CNS 缺 `via` 時 validator 失敗並點名 Symbol 與 `via`
25. verified convention 只有一份出處或兩筆同名文件時 validator 失敗；兩份不同文件時通過結構檢查
26. verified regulation 沒有 HTTPS URL 或定位資訊時 validator 失敗
27. verified 缺 `verified_at` 或 `verified_by` 時維持失敗；`caution = null` 仍可通過
28. 11/14 verified 時 validator 失敗並印出 78.6% 未達 80%；12/14 時通過門檻
29. 可索引四頁 Lighthouse 三次中位結果四類皆 ≥90
30. 找找看 Lighthouse 三次中位結果的 Performance、Accessibility、Best Practices 皆 ≥90；其 `noindex` 由案例 18 驗證
31. pull request 與 main workflow 都會執行 typecheck、build／validator、Playwright、Lighthouse，任一失敗會讓 job 失敗
32. production smoke：五張代表頁、sitemap、robots、共用 OG 圖與圖示從公開 Vercel URL 取得成功

## Out of Scope

- 購買或直接核對 CNS 11567 原文；也不宣稱轉載畫法與最新版 CNS 完全一致
- 自訂網域、DNS、網域轉址或從 Vercel host 搬 canonical
- 新增 CMP、consent modal、偏好設定頁或完整地區法遵系統；若受眾超出台灣需另開規格
- Google Ads、remarketing、Google Signals、User-ID、跨裝置識別、BigQuery export
- 除 `symbol_view` 以外的新事件，包括搜尋文字、quiz completion、答對率、停留時間自訂事件與熟悉度同步
- 每個 Symbol 各自一張動態 Open Graph 圖；階段一只用一張共用圖
- 保證 JSON-LD 產生 Google rich result 或提升排名；本規格只保證語意正確、可解析且不誤導
- axe、VoiceOver、NVDA、完整人工無障礙稽核、WCAG 等級聲明；既有鍵盤／ARIA 回歸仍在 scope
- 讓完全看不見畫面的使用者能等價完成視覺辨識型找找看
- 為所有 14 張 Symbol 頁與所有未來動態頁各跑一次 Lighthouse；代表頁驗效能，結構測試驗全部生成頁
- 改寫既有設計語言、重畫頁面或新增行銷內容；只修達成 RWD／Lighthouse／metadata gate 所需的問題
- Vercel 專案建立、首次部署或自動部署設定；production URL 已存在且已由使用者確認
- M6 的第二、第三張格局與上線後分析決策

## Further Notes

- **目前查證率是 1/14。** 不買 CNS 仍可達 12/14：雨遮 1 筆＋4 筆透明轉載＋至少 7 筆 convention 雙來源。若把「看過 CNS 原文」重新放回 `verified` 的必要條件，理論上限只有 10/14 = 71.4%，會與 80% gate 算術衝突
- 4 筆 CNS 轉載現有定位寫在公會規範 p32，但「引用 CNS11567」的表 14 標題位於 p31；完成查證前要核對並修正定位，不能只補 `verified_at`／`verified_by`
- `source` 是「從哪一種產品入口開始理解 Symbol」，不是 Source Tier，也不是外部流量來源。外部歸因交給 GA 自有的 acquisition dimensions，不把它塞進 `symbol_view.source`
- Google 的 Consent Mode 文件要求 default consent 在 config／event 前，並支援 region-specific defaults；本規格用這個 seam 保留未來擴張能力：[Set up consent mode](https://developers.google.com/tag-platform/security/guides/consent)、[Consent mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode)
- GA4 standard property 的 event-level retention 可選 2 或 14 個月；本階段選 2 個月。這個設定不影響 standard aggregated reports：[Data retention](https://support.google.com/analytics/answer/7667196)
- Google 建議在適合的情況使用 JSON-LD，但正確標記也不保證 rich result；`DefinedTerm`、`CollectionPage`、`LearningResource` 是 Schema.org 語意型別，不應被包裝成 Google 已支援的特殊搜尋外觀：[Google structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)、[Schema.org](https://schema.org/)
- M5 的 Lighthouse gate 量 build 產物，不量 production 網路抖動；production 只做可取得性與 metadata smoke。兩者回答的是不同問題，不能互相取代
- 這份 spec 已經完成規格階段；下一步應以 `/to-tickets` 按「Analytics／SEO 資產／品質 gate／內容查證」的可獨立驗收邊界切票，不再對整份 PRD 重新規格化
