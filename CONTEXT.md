# 平面圖教學網站

教台灣一般買房者看懂建案平面圖：點圖上的符號，就知道那是什麼、以及該注意什麼。
內容的核心主張不是「答案是這樣」，而是「這個答案從哪份文件來、可信到什麼程度」。

## Language

### 內容層

**Symbol（符號）**：
平面圖上一個可辨認的圖形記號所代表的東西，例如「密閉式撒水頭」「一般單開門」。它是內容，與任何一張圖無關。
_Avoid_: 圖例、icon、element、元件

**Source Tier（來源層級）**：
一個 symbol 的說法出自哪一級文件：`cns` / `regulation` / `convention` / `varies`。它描述**答案的出處**。
_Avoid_: 可信度、credibility、等級

**Verification Status（查證狀態）**：
查證流程走到哪一步：`verified` / `partial` / `pending_purchase` / `blocked`。它描述**我們做到哪**，與 source tier 是兩條不同的軸，不可互相取代或合併顯示。
_Avoid_: 狀態、進度

### 圖面層

**Layout（格局）**：
一戶房子的房間組成與相對關係——「三房兩廳」這件事。手寫，描述拓樸與比例，**不含任何座標**。也是使用者面對的單位：`/layouts/[id]`、學習進度、找找看都綁在它身上。
_Avoid_: layout spec、格局圖、平面圖、floorplan

**FloorPlan（平面圖）**：
由一個 layout 展開出來的具體圖面——座標、牆、開口、傢俱、熱區。**由程式產生，不得手改**；SVG 是它的一個投影，不是資料。
_Avoid_: layout、plan data、圖檔

**圖面（Artwork）**：
一張 floorplan 被畫出來的樣子——牆、房間、門窗、傢俱、尺寸標註。
它是 floorplan 的**投影**而不是資料：改它不會改變任何事實，改資料才會。
由檢視器自己讀 floorplan JSON 畫出來（`components/FloorPlanRenderer.tsx`，`docs/adr/0005`），
**畫法可以依互動狀態改變**——那正是它從產生器的靜態產物換成 React renderer 的理由。
熱區層不在圖面裡，由檢視器依 hotspots 另外畫。
_Avoid_: 「圖面產物」（曾經指 `data/layouts/*.svg`，那條路已在 `docs/adr/0005` 結束）、圖檔、拿「SVG」指涉圖上有什麼東西

**Hotspot（熱區）**：
floorplan 上一個可點擊的區域，指向一個 symbol。一個 symbol 在同一張圖上可以有多個 hotspot，每個 hotspot 有自己的全檔唯一 id。
說明卡上的「這張圖上共 N 處 · 目前第 M 處」數的就是這些 hotspot（PRD §6.3.2）；
程式裡把「同一個 symbol 的第幾個 hotspot」這件事叫 **occurrence**，它是 hotspot 的一個面向，不是另一種東西。
_Avoid_: 標記、marker、annotation（`annotation` 在 floorplan 裡另有所指：尺寸標註）

**閱讀順序（Reading Order）**：
鍵盤走過一張圖上所有熱區的順序——**依房間，房間內依符號類別**（結構 → 門窗 → 家具家配）。
房間的先後對上「看屋時一間一間看」的動線（玄關 → 公共區 → 私密區），不是座標掃描；
熱區屬於哪一間房**由 `rooms` 的幾何在 build 時算出**，不進 floorplan schema（`lib/floorplan/reading-order.ts`）。
它與 occurrence 的「第幾處」是兩種順序，**刻意不統一**：一個是動線，一個是編號。
_Avoid_: tab 順序（它同時是 DOM 順序、也是讀螢幕的順序，不只 tab）、動線（那是房間之間的事，不含房間內的類別）

**State（互動狀態）**：
單一 hotspot 此刻的狀態（`normal` / `candidate` / `selected` / `highlighted` / `quiz-target` / `discovered`）。純執行期資料，**不進任何資料檔**。
`candidate` 是兩段式點擊第一段圈出的候選之一，`selected` 是第二段確認的那一個——兩件不同的事，
不可用 `highlighted` 概括；`highlighted` 留給 M3「符號頁 → 平面圖」的自動高亮（PRD §6.2.1）。
_Avoid_: 模式、mode、idle（要說「沒有在互動」就用 `normal`）

**Stage（互動階段）**：
兩段式點擊走到哪一段（`browsing` / `candidates` / `confirmed`）。它描述**整個檢視器**，
State 描述**單一 hotspot**，兩者不可互換：`candidates` 階段裡有一群 `candidate` 狀態的 hotspot。
_Avoid_: 步驟、step、模式

**View（視野）**：
畫面現在看著圖面的哪一塊——中心點（圖面 cm）與放大倍率。純執行期資料。
容錯半徑一律以 CSS px 定義，判定時依當前 View 換算回圖面 cm。這兩個單位混用是本 repo 壞過兩次的地方
（PRD v0.5 的「46 SVG 單位」、原型放大後重算容錯圈）。
倍率的上下限**相對 fit**（整張圖剛好放得下）定義，不是絕對倍率：說明卡升起來時 fit 小於 1，
上下限跟著框走才講得通（`docs/adr/0004`）。
_Avoid_: viewBox（那是 SVG 屬性，固定是整張圖、不隨操作改變）、鏡頭、視角

**錨點（Anchor）**：
縮放時畫面上不動的那一點——雙指的中點、雙擊的落點。一律以**螢幕座標（CSS px）**表達，
因為它要固定的就是「螢幕上這個位置」；換算成圖面公分再換回來只會多一次誤差。
_Avoid_: 縮放中心（聽起來像圖面座標）、focal point

### 符號層的爭議詞

**樑**：
平面圖上部的主結構投影線（規範 p18 表 6 的「梁線」）。製圖標準**不區分明樑與暗樑**，所以本專案只有一個符號。
_Avoid_: 暗樑、明樑（房產與室內設計圈的用語，不是製圖用語；收在 `aliases` 供搜尋，不得當成獨立概念）

**出入口**：
牆斷開、沒有門扇的開口（表 8 第一項）。開放式廚房、走道通客廳那種寬開口就是它。
_Avoid_: 寬開口、無門、加寬的推拉門（後者會在圖上畫出兩片不存在的門扇）

**轉載（`source_refs.via`）**：
經由他人文件讀到某份標準的內容，而未核對標準原文。tier 照實填該標準，但必須用 `via` 揭露轉載出處。
_Avoid_: 把轉載當原文引用；把 `cns` 與「讀過 CNS」劃上等號

## 命名慣例

**格局名稱一律寫「N 房 M 廳」**，其中「廳」＝客廳＋餐廳。有客廳有餐廳就是兩廳，只有客廳就是一廳。
衛浴數不是廳數，只在需要時附在後面（「三房兩廳兩衛」），**不得用來取代廳數**（不可寫「三房兩衛」當作格局名）。
套房、長型街屋這類是**格局型態**而非房廳計數，直接用型態名。

**格局 id 用房廳縮寫＋變體**：`3b2l_standard`（3 bedroom / 2 living）。一旦上線不得更改。
