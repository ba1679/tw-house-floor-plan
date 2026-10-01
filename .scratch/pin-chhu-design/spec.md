# 拼厝（Phin-Chhù）品牌與讀圖桌設計更新

Status: ready-for-agent

## Source of truth

- 視覺規則：[`DESIGN.md`](../../DESIGN.md)
- 完整標記幾何：使用者 2026-09-30 提供的[參考圖](../../design/reference/pin-chhu-logo.png)，僅採輪廓與內部分隔；下方文字與棋盤背景不採用。品牌色票依 2026-10-01 使用者提供的新版標記與指定色碼更新。
- 版面定案：`prototype/pin-chhu` 的 `843bf77`（方向 C 讀圖工具骨架；方向 B 僅取低密度格線節奏；方向 A 的完整 logo 後依使用者參考圖重畫）
- 產品行為：[`平面圖教學網站-PRD-Phase1.md`](../../平面圖教學網站-PRD-Phase1.md)
- 既有互動決策：ADR-0003（InfoSheet 是版面列）、ADR-0005（viewer 自畫 FloorPlan）、ADR-0006（highlight 是 layer）、ADR-0007（找找看暫停屬於 Round）
- 品牌決策：ADR-0009（雙尺度拼圖標記與讀圖桌）

## Problem

現有 B2 數位圖鑑 App 將網站表現成中性、卡片化的現場速查工具；它沒有反映使用者在看屋前或回家後，會花時間慢慢研究格局、回看符號與練習辨識的情境。它的視覺又太接近常見 AI 產品：安全的白灰卡、無地方性、沒有可被記住的品牌核心。

本次不增加新的產品資料或功能，而是用「拼厝」重新編排既有內容：完整島嶼拼圖標記提供在地記憶；讀圖桌讓實際格局先成為入口；少量窗花格線提供編輯節奏。圖面、來源、State、兩段式點擊與找找看仍是產品的可靠核心。

## Product and visual decision

- 正式名稱：**拼厝**
- 羅馬字：**Phin-Chhù**
- 品牌意義：把平面圖的格、線與空間慢慢拼成對一個家的理解；名稱取「起厝」與「拼湊」的語感。
- 一句品牌承諾：**看懂格局，慢慢拼成家。**
- 首次說明／SEO 文案必須明示產品是「建案平面圖／格局」的教學與閱讀工具，不能只說品牌故事。
- Logo：完整品牌標記依使用者指定的台灣拼圖參考重畫；header、favicon、app icon 用同一個 Module 的 compact mark，不能縮小完整版湊用。
- 色彩：橡木棕、暖陶土、燕麥奶白、鼠尾草綠與深碳灰外框構成品牌層。日光花磚高彩度探索不採用。
- 網站骨架：首頁採原型 C 的讀圖桌，格局入口優先；只借原型 B 的低密度格線、對齊與不對稱分欄，不採其深色首頁、旋轉圖或直排品牌欄。
- 平面圖與 State：`--state-*` contract 不更動。依使用者 2026-10-01 明確核准，主臥、客廳、餐廳／廚房、衛浴／陽台的地板分別使用指定品牌色；其他房型保留中性底色。顏色不表示分類、答題正誤、學習進度或 Hotspot State，亦不推論平面圖方位。
- 字體：維持系統 sans；雜誌閱讀感由字級、行距、留白、框線與編輯式分欄產生。
- 找找看：保留既定的正確／錯誤結果區，讓作答後一眼可判讀；結果是 `QuizRound`／Round 的責任，InfoSheet 保持後續理解的責任。

## In scope

1. 讓站名、品牌承諾、metadata、Structured Data、header、favicon、app icon 與 OG image 一致改為拼厝。
2. 建立同一個品牌標記 Module，提供 `full`、`compact` 與淺／深表面 variant，集中 SVG、可及性文字與小尺寸 fallback。
3. 建立品牌／閱讀 tokens，更新全站 shell 與 header；指定房型地板依核准配對呈現，牆柱、符號、文字與 State token 的語意不變。
4. 將首頁改為讀圖桌：清楚引言、真實格局入口、符號／分類的次要入口，以及克制的品牌區與格線節奏。
5. 將分類頁、符號頁、平面圖與 InfoSheet 重新排成可慢讀的編輯版面，保留所有資料順序、行為、路由與無障礙 contract。
6. 在找找看加上強、固定、非紅綠的答對／答錯結果區；答錯依然自動開題目 Symbol 的 InfoSheet。
7. 建立跨頁視覺、可及性、SEO 與高度預算回歸檢查。

## Out of scope

- 新增或改動 Symbol、FloorPlan、Hotspot、來源、`confused_with`、熟悉度、題目挑選、Analytics event contract 或任一既有 route。
- 新增帳號、收藏、看屋 checklist、房屋評分、AI 問答、照片、插畫、網路字型或深色模式。
- 以品牌色標注正誤、分類或學習進度；指定房型地板色依使用者核准的配對呈現。
- 改寫兩段式點擊、pan／zoom、答題判定、InfoSheet 作為 layout row 的結構，或改動 ADR-0003～0008 的結論。
- 將原型 route、原型 CSS 或 prototype-only controls 帶進 production。

## Architecture and module seams

| Module | Interface | Implementation responsibility | Explicit non-responsibility |
| --- | --- | --- | --- |
| Brand mark | `variant: full | compact`、surface variant、accessible label | 拼塊幾何、色塊比例、外框、小尺寸 fallback | 不決定頁面導覽、文案或 metadata |
| Site identity | 一處提供站名、羅馬字、品牌承諾與 metadata copy | header、metadata、JSON-LD、OG／icon 共用文字來源 | 不持有 Logo SVG |
| Page composition | 各頁吃既有資料並排成閱讀版面 | 留白、分欄、格線節奏、CTA 層級 | 不改資料 schema 或重排資料的語意順序 |
| FloorPlan viewport | 現有 `FloorPlanViewport` props | 畫圖面與既有 State／interaction | 不知道正答、錯答或品牌色 |
| Quiz result | Round answer 與 names | 立即宣告答對／錯與控制項之間的固定區塊 | 不取代 InfoSheet 的說明或改寫判定 |

這些 Module 的 Interface 要小：頁面不自行選一組 Logo 色塊或複製 SVG，viewport 不接 `correct`／`incorrect` copy。這樣品牌改動有 locality，圖面與答題規則則不因視覺工作被侵入。

## Experience decisions

### 1. Global shell and identity

每頁 header 都有 compact 拼圖標記、可選取的「拼厝」與「Phin-Chhù」，整組連回首頁。完整標記只在首頁 hero／品牌內容與 share asset 出現。header 不做懸浮 toolbar，也不做全站深色帶。

燕麥奶白閱讀面與深碳灰框線屬於 shell。指定房型地板依核准配對著色，首頁縮圖、自由看圖與找找看使用同一個 renderer；牆柱、符號、文字、State 與 source tier 的語意不變。品牌裝飾維持低密度。

### 2. Home: reading desk

首頁首屏先提供：這個工具是什麼、今天可讀的格局、開始讀圖的主 CTA。格局或忠實縮圖必須先於 decorative hero 被看見。完整 logo 可以放在獨立品牌欄；低密度格線可留在那個欄位或節奏空白區，絕不覆蓋格局圖。

符號搜尋、分類瀏覽與找找看是通往既有功能的次要路徑；不發明假資料或新內容填版。

### 3. Category and symbol reading pages

分類頁以目錄與對齊掃讀，符號頁以可慢讀的條目節奏呈現。Symbol Art、白話意義、Source Tier、完整出處、容易搞混與前往格局的內容與順序都不改；僅更換容器、框線、字級與局部格線的表達。

### 4. Floorplan and InfoSheet

平面圖依然是最大的內容圖，一個螢幕頁面不能捲。InfoSheet 仍壓縮圖面高度、保留唯一陰影與焦點規則。指定房型地板可使用核准底色並保留房名；不得另外加入品牌裝飾方格或改寫圖面資料。視覺更新需更清楚地區分「圖面」「說明」與「下一個動作」，不能把 Sheet 做成 modal。

### 5. Quiz feedback

作答後，圖框和「看說明／下一題」控制之間必定顯示結果區：

- 答對：深碳灰實心、形狀清楚的勾、`答對`、`你找到了「X」`。
- 答錯：深碳灰強框、`答錯`、`你點的是「Y」`、`正確答案是「X」`。

正誤由 `isCorrect(answer)` 與 Round state 供應。答錯同時自動開題目 Symbol 的 InfoSheet，讓 `confused_with` 差異解釋被保留；結果區不得把它吞掉。結果訊息用可被讀螢幕即時宣布的文字，而不是色彩或動畫。

結果區使用閱讀介面的語意 tokens，不借用房型底色。Quiz 自行計算包含 header、題目、結果、動作列、InfoSheet 與 footer 的高度預算；窄螢幕上結果文字能換行，答錯與 Sheet 展開時仍可見圖面和下一題控制。

## Delivery order

| Order | Ticket | Depends on |
| --- | --- | --- |
| 1 | 01 品牌 identity contract 與雙尺度資產 | — |
| 2 | 02 品牌 tokens、global shell 與 header | 01 |
| 3 | 03 首頁讀圖桌與導航入口 | 01, 02 |
| 4 | 04 分類與符號條目的編輯閱讀頁 | 01, 02 |
| 5 | 05 平面圖與 InfoSheet 的閱讀編排 | 02 |
| 6 | 06 找找看的明確作答結果 | 02, 05 |
| 7 | 07 可及性、SEO 與視覺回歸 | 03–06 |

## Validation strategy

- 每張票先跑相關 unit／Playwright tests，整體至少通過 `npm run validate`、`npm run validate:floorplan`、typecheck 與 `npm run build`。本功能不允許修改 floorplan data 或產生出的圖面資料。
- 任一會畫入 CSS 的票先核對 `DESIGN.md`；品牌 token、`--fp-*`、`--state-*` 需分組命名並以測試／視覺驗證防止相互覆寫。
- 目視檢查 375 × 812；平面圖與找找看另檢查 320 × 568，無水平捲動、無 document scroll，InfoSheet 開啟時仍看得到圖。
- 測試完整／compact logo 的可見與可及性：header、首頁、深／淺品牌表面、favicon／app icon、OG image。中文與羅馬字必須是可選取文字；SVG 不把中文轉 path。
- 找找看結果要以文字即時宣布；鍵盤焦點、`prefers-reduced-motion`、既有 State 3:1 對比、灰階可辨性與 Analytics event contract 不得退步。
- 房型底色的配對、預設中性底色與 InfoSheet 開關後的暗化／還原需有瀏覽器回歸檢查；State 的形狀、白襯邊、標記與文字在各房型底色及暗化面上仍可辨認。
- metadata、canonical、JSON-LD、sitemap 與 noindex quiz contract 保持正確；改品牌不得降低「平面圖／格局」相關的搜尋意圖說明。
