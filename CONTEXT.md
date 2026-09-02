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

**圖面產物（FloorPlanArtwork）**：
一張 floorplan 被畫出來的那份 SVG——牆、房間、門窗、傢俱、尺寸標註。由 floorplan-generator 產生，
是 floorplan 的投影而不是資料：改它不會改變任何事實，改資料才會。
檢視器目前直接顯示這份產物、不自己重畫（`docs/adr/0002`，是延後不是終局）；
熱區層不在裡面，由檢視器依 hotspots 另外畫。
_Avoid_: 單講「圖面」（FloorPlan 詞條裡的「具體圖面」指的是資料本身）、圖檔、拿「SVG」指涉圖上有什麼東西

**Hotspot（熱區）**：
floorplan 上一個可點擊的區域，指向一個 symbol。一個 symbol 在同一張圖上可以有多個 hotspot，每個 hotspot 有自己的全檔唯一 id。
_Avoid_: 標記、marker、annotation（`annotation` 在 floorplan 裡另有所指：尺寸標註）

**State（互動狀態）**：
使用者此刻正在跟某個 hotspot 做什麼（`normal` / `highlighted` / `quiz-target` / `discovered`）。純執行期資料，**不進任何資料檔**。
_Avoid_: 模式、mode

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
