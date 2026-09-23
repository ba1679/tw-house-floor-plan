# M6 公開前可觀測性與 UX 打磨

Status: ready-for-agent

來源：`平面圖教學網站-PRD-Phase1.md` v0.8 §5、§9.1、§13（M6）
既有實作：M2 檢視器、M3 符號頁與站內搜尋、M4 找找看；M5 交付 GA4 基礎載入、頁面 engagement 與 `symbol_view`
設計語言：`DESIGN.md`（本 spec 已先把 header 與說明卡動效的允許範圍寫入）
相關 ADR：0003（說明卡是版面的一列）、0004（自動放大不縮小使用者視野）、0007（找找看暫停屬於一局）

---

## Problem Statement

M5 可以把網站放到正式網址，也能知道某個符號被看過；但準備把網址公開分享時，還回答不了真正會影響下一步的問題：

- 使用者從首頁、Google 符號頁、平面圖還是找找看開始？
- 他在什麼頁面真的停留？
- 平面圖的兩段式點擊是被理解了，還是第一段之後就放棄？
- 找找看有多少人開始、完成，哪個符號最常認錯、又被認成什麼？

畫面上也有幾個會在公開後放大的斷點：除了找找看結算，站內沒有穩定的回首頁路徑；沒有 header 或品牌入口；說明卡瞬間出現，版面改變沒有空間連續性；卡片展開後只剩關閉整張卡，沒有把長內容收回、回到平面圖的控制。

M6 的目的不是「多埋一些 event」或「加幾個動畫」，而是讓公開後的數據可以回答產品問題，同時先修掉已知的導覽與說明卡摩擦。

## Outcomes

1. 每一個事件都能對到一個產品問題、固定觸發點與低基數參數。
2. 可從 GA4 讀出內容入口、平面圖兩段式漏斗、說明卡深度與找找看漏斗。
3. 每一頁都有清楚的品牌／回首頁入口。
4. 說明卡進出、展開與收合有連續的空間感；減少動態時直接切到最終狀態。
5. 展開長內容後永遠有「收合看平面圖」，不必關掉整張說明才回得去。

## Non-goals

- 不做使用者帳號、跨裝置識別、User-ID、session replay、heatmap 或錄影。
- 不追蹤每一個普通連結、每一幀 pan／zoom、指標座標、自訂逐秒停留時間。
- 不把 GA 當成資料庫，不把完整學習進度或 localStorage 內容送出去。
- 不在 M6 根據少量資料決定第 2、3 張格局；那是 M7。
- 不重畫首頁、符號頁或找找看的整體視覺；只處理 header 與說明卡所需的版面調整。
- 不讓說明卡變成覆蓋平面圖的浮層；ADR-0003 不變。

## User Stories

1. As a 從 Google 落在任一內頁的人, I want 一眼看見站名並能回首頁, so that 我知道自己在哪個網站，也不會被困在單頁
2. As a 手機使用者, I want header 不吃掉平面圖的必要操作空間, so that 我仍能在一個螢幕裡看圖與操作
3. As a 點開說明卡的人, I want 卡片與平面圖的版面變化連續, so that 我知道剛才選到的內容去了哪裡
4. As a 容易暈動的人, I want 系統要求減少動態時不播放滑動動畫, so that 我仍能安心使用
5. As a 展開長說明的人, I want 隨時按「收合看平面圖」, so that 我不必關掉說明、丟掉目前選到的符號
6. As a 鍵盤使用者, I want 展開／收合是同一個可聚焦控制, so that 狀態切換後焦點不會消失
7. As a 產品維護者, I want 看到不同頁面的前景 engagement time, so that 我知道哪類內容真的被讀
8. As a 產品維護者, I want 知道首頁、分類、搜尋、header 與符號頁轉換點各帶來多少核心互動, so that 我能調整入口優先序
9. As a 產品維護者, I want 知道第一段點擊到第二段確認的轉換與失敗, so that 我能判斷兩段式是否造成摩擦
10. As a 產品維護者, I want 知道哪些說明常被展開又收合, so that 我能判斷摘要高度與內容順序是否合理
11. As a 產品維護者, I want 看找找看的開始、逐題作答與完成, so that 我能分開「沒興趣」「中途離開」「內容太難」
12. As a 產品維護者, I want 看單一符號正確率與誤認對象, so that 下一輪先改善最有證據的內容
13. As a 使用者, I want 我輸入的未知搜尋文字不被原樣送往第三方, so that 自由輸入不會意外變成追蹤資料
14. As a 開發者, I want analytics 呼叫有型別與單一入口, so that event 名稱與參數不會散在元件裡分岔
15. As a 開發者, I want 測試環境不用真的連 GA, so that 瀏覽器測試可以精確驗事件且不污染正式資料

## Analytics Decisions

### 1. 先用自動量測回答頁面停留

GA4 的 engagement time 只計頁面在焦點中、瀏覽器在前景的時間。M6 用 `page_view`／`user_engagement` 與 page path／page title 比較首頁、符號頁、分類頁、平面圖與找找看，不另造 `page_dwell`。

不做 section timer。說明卡是否有深度，用 `symbol_view`、`info_sheet_action: expand/collapse/close` 與頁面 engagement 一起解讀；目前流量規模不值得承擔 unload beacon、重複計時與背景分頁誤差。

### 2. 一個 typed gateway，元件不直接碰 `window.gtag`

M5 的 GA 載入層在 M6 收成單一 analytics 模組：

- 對外暴露有型別的產品事件函式或 discriminated union。
- production measurement id 不存在或 `window.gtag` 尚未就緒時，呼叫安全地 no-op。
- 測試可以注入／讀取 memory sink；不得以攔截 Google 網路請求當唯一測試。
- 所有事件名稱、參數 key 與 enum 值只有一份 source of truth。
- 開發模式可把 payload 印到明確的 debug sink，但預設不寫正式 property。

### 3. 事件字典

#### `symbol_view`

完整說明第一次可讀時送：

- 符號頁：頁面 client 接手後一次，`surface = symbol_page`
- 自由看圖：一個 hotspot 確認、InfoSheet 打開時一次，`surface = layout_sheet`
- 找找看：使用者在答後每次明確按「看說明」、讓關閉的卡片重新打開時一次，`surface = quiz_sheet`；同一次開啟期間的 rerender 不重送

找找看作答後若卡片沒有開，不算 `symbol_view`；只在圖上揭露答案不是閱讀說明。

必要參數：`symbol_id`、`surface`。自由看圖另帶 `layout_id`、`hotspot_id`；找找看帶 `layout_id`，但正誤留在 `quiz_answer`，不重複。

#### `select_content`

沿用 GA recommended event。只量具產品意義的入口：

- `header_home`
- `home_layout`
- `home_quiz`
- `category_symbol`
- `search_result`
- `symbol_layout`
- `layout_quiz`
- `quiz_review_symbol`

必要參數：`content_type`、`item_id`、`origin_page_type`。外部連結與普通文字連結不在這張名單裡。

#### `search`

即時搜尋沒有 submit，因此定義「完成一次搜尋」為：IME composition 已結束、正規化 query 非空，且輸入停止 750ms；同一個正規化 query 在該元件生命週期只送一次。

- 完整等於既有 `name`／`aliases`：`search_term` 送那個白名單詞。
- 其餘：`search_term = other`，不送原字串。
- 另帶 `result_count` 與 `search_surface: home | category`。

點結果另送 `select_content: search_result`。`search` 是需求與結果，`select_content` 是採取行動，不能互相取代。

#### `layout_interaction`

`action` 只允許：

- `candidates_shown`：由 browsing 進 candidates；帶 `candidate_count` 與 `input_method`
- `symbol_confirmed`：由 candidates／鍵盤直接選定進 confirmed；帶 `symbol_id`、`hotspot_id`、`input_method`
- `confirm_missed`：第二段沒有命中
- `reselect`
- `reset_view`
- `manual_pan`、`manual_zoom`：每次檢視器掛載各最多一次，只回答「有沒有用過」，不量每幀與距離

事件依 reducer 前後狀態判斷，只有真的完成狀態轉移才送。pointer／touch 產生的相容 mouse event 不得雙送。

#### `info_sheet_action`

`action` 只允許 `expand`、`collapse`、`close`、`next_occurrence`。必要參數：`layout_id`、`symbol_id`、`context: layout | quiz`。開啟本身由 `symbol_view` 表示，不再送 `open`。

#### `quiz_start`、`quiz_answer`、`quiz_complete`

- `quiz_start`：按下開始或再玩一次並成功建立一局後送；帶 `question_count` 與 `start_type`。
- `quiz_answer`：`answers.length` 增加的那次狀態轉移送且只送一次；帶 target／picked／hotspot／correct／index／input method。
- `quiz_complete`：進入 finished 一次；帶 `question_count`、`correct_count`。

不另送 `quiz_abandon`。完成率以 complete ÷ start 看；離頁事件在瀏覽器關閉時不可靠，為了補一個名字引入 beacon 與去重不值得。

### 4. 資料邊界

- 不送任何 PII、使用者／session 唯一 id、自由輸入原文、精細位置、點擊座標或 timestamp。
- `symbol_id`、`layout_id`、`hotspot_id` 都來自 repo 的有限資料集合，允許註冊為 event-scoped dimension。
- 布林與計數用 boolean／number，不把數字拼進字串 enum。
- 參數只有實際分析會用的才註冊；避免耗掉 custom dimension 配額與製造高基數。
- 此台灣部署不設 GA consent gate。資料保留、Google Signals／廣告個人化與內部流量排除仍列入公開前人工 checklist；若日後改變服務法域，再重新決定資料收集策略。

## UX Decisions

### 1. 全站 header 與品牌入口

- `RootLayout` 在內容前放一個 `SiteHeader`，所有頁一致。
- 品牌入口由單色 code-native 平面圖線框＋`SITE_NAME` 組成，整組連回 `/`；可存取名稱是「回首頁：平面圖教學」。
- 不用房子屋頂剪影，不載圖片或字型；介面仍是黑白，彩色留在圖上。
- 首頁原本的站名小字不再是唯一識別；實作時避免在同一視窗出現兩個視覺上相同、只有一個可點的 wordmark。
- header 是正常版面列，不 fixed、不 overlay。平面圖與找找看重新計算 100dvh 高度，保留頁尾讓位規則。

### 2. 說明卡展開／收合控制

- 內容 overflow 且卡片收合時，控制字改為「展開完整內容」。
- 展開後同一顆控制留在原本的固定位置，改為向下箭頭＋「收合看平面圖」。DOM control 不替換，鍵盤焦點留在原處。
- 收合時 `body.scrollTop = 0`，讓摘要與平面圖一起回來；selected hotspot、current occurrence 與卡片本身都不關閉。
- 關閉 × 仍是「關整張說明」；收合只是改高度，兩個行為與 analytics action 分開。

### 3. 說明卡動效

- 允許四種結構性轉移：進場、退場、展開、收合。
- 動效要讓卡片高度與平面圖可視帶同步改變；不得先跳圖再滑卡，或把卡片改成浮層。
- 熱區 state、答對答錯與圖面記號不加動畫。
- `prefers-reduced-motion: reduce` 時直接切到最終狀態。
- 實作值留在 CSS token／module；`DESIGN.md` 只保存理由與規則。

## Accessibility and Responsive Decisions

- header 品牌連結、展開／收合、關閉鍵皆至少 44 × 44 CSS px 可點，focus-visible 沿用全站雙環。
- 展開／收合控制以 `aria-expanded` 表達狀態並指向說明 body；可見文字本身也必須說清楚行為。
- 卡片開關焦點規則沿用 M2／M4；只展開或收合時焦點不搬家。
- 375 × 812 為設計基準；另驗 320 × 568 的 header、標題列、狀態列、控制列、卡片與頁尾不產生水平捲動，收合控制始終可達。
- 說明卡展開時平面圖可以被壓得很小，但不可把「收合看平面圖」壓掉；收合後圖框必須恢復可操作尺寸。

## Testing Decisions

### 純事件契約

- node／typecheck 驗事件名稱、必填參數與 enum；未知 event/action 編譯失敗。
- analytics disabled 或 gtag 未就緒時 no-op，不 throw。
- 搜尋 sanitizer：完整命中名稱／alias 才能送原詞；partial、零結果、任意 email／電話樣本都只送 `other`。

### 瀏覽器事件測試

測試讀 memory sink，斷言「觸發一次、payload 正確、沒有多送」：

- 符號頁、自由看圖卡片、找找看卡片三種 `symbol_view`
- 搜尋 debounce／IME／結果 click
- 兩段式候選、確認、沒點中、重選；pan／zoom 去重
- 說明卡展開、收合、其他位置、關閉
- 找找看 start、replay、每題 answer、complete；答錯 payload 包含 target 與 picked

不得只測「呼叫了某個 helper」；至少一條真瀏覽器路徑要從使用者操作走到 sink。

### UX 與視覺回歸

- 每一個建置出的內容頁都有 header 與有效的首頁連結。
- 375 × 812、320 × 568：header 不遮內容，平面圖頁不捲動，說明卡展開後能收合並恢復圖框。
- 鍵盤：控制焦點在 expand → collapse → expand 間不丟失；Esc 與 × 的既有關閉行為不變。
- reduced motion media emulation 下沒有 transition／animation duration；一般模式下只允許 DESIGN.md 列出的結構性動效。
- 全套既有測試、typecheck、build 維持綠。

## GA4 Setup and Release Gate

程式合併不等於量測完成。公開分享前必須用 production-equivalent property 做一次人工驗證：

1. Realtime／DebugView 看得到本 spec 的八種 event 名稱。
2. 逐一展開 payload，確認 enum、id、boolean、count 正確，且沒有 query 原文、座標或其他自由文字。
3. 建立真正會用到的 event-scoped dimensions／metrics；記錄名稱與 parameter key。
4. 建立至少四份 Exploration 草稿：內容入口、平面圖漏斗、說明卡操作、找找看漏斗／符號混淆。
5. 排除開發／內部流量，確認資料保留與廣告個人化設定符合站主選擇，公開頁能找到分析資料說明。
6. 寫下 observation window 與最低樣本提醒；M7 不以一兩天或個位數使用者下結論。

## Ticket Plan

1. Analytics gateway 與事件契約
2. 全站 header、品牌與回首頁
3. 說明卡展開／收合與結構性動效
4. 內容入口、導覽與搜尋事件
5. 平面圖與說明卡事件
6. 找找看漏斗事件
7. GA4 後台設定、DebugView 與公開前驗收

## References

- GA4 user engagement：<https://support.google.com/analytics/answer/11109416>
- GA4 events：<https://developers.google.com/analytics/devguides/collection/ga4/events>
- Event parameters 與 custom dimensions：<https://developers.google.com/analytics/devguides/collection/ga4/event-parameters>
- 避免送出 PII：<https://support.google.com/analytics/answer/6366371>
