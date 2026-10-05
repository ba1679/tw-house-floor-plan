# 家具與尺寸：第 07 票整合核對

> 本文記錄 2026-10-05 第 07 票完成時的核對結果。當日稍後使用者決定改採[公開自填試用](../../.scratch/phase2-furniture-dimensions/study/README.md)；以下原定五人受主持「下一步」保留作歷史背景，不是目前待執行門檻。

核對日期：2026-10-05（Asia/Taipei）。範圍為 [第 07 票](../../.scratch/phase2-furniture-dimensions/issues/07-usable-study-materials.md)及第 08 票可直接使用的[試用材料](../../.scratch/phase2-furniture-dimensions/study/README.md)。此紀錄只證明程式與內容**可試用**；尚未進行真實讀者教學驗收。

## 原始資料、定位與示範計算

正式文案的 `basis.document` 與 `basis.locator` 已逐筆對照原始 JSON；本批判讀主張只以本站生成的教學範例及其可見條件成立，沒有聲稱查過未列出的外部法規或特定建案。

| 內容主張 | 原始定位與核對結果 |
| --- | --- |
| 導讀的床、衣櫃、門窗位置 | [完整 FloorPlan](../../data/layouts/3b2l_standard.floorplan.json) 的 `rooms[id=room-master]`、`furniture[id=f-bed-m/f-wardrobe-m]`、`doors[id=door-master]`、`windows[id=win-master]`；[正式內容](../../data/guides/furniture-dimensions.json) 的 `evidence[id=master-bedroom-example]`。局部圖未展示床長寬或主臥淨尺寸。 |
| 尺寸線量測範圍 | 同一 FloorPlan 的 `annotations[id=dim-overall-w]` 為 `(0,0) → (977,0)`、文字 `977 cm`；`dim-overall-h` 為 `(0,0) → (0,782)`、文字 `782 cm`。四面外牆牆心線在 `x=0/977`、`y=0/782`；相減各為 `977`、`782 cm`，不是外牆外緣或主臥淨尺寸。與[第二步查證](phase2-dimension-evidence.md)一致。 |
| 使用空間與清單 | `doors[id=door-master].opens_to/swing_arcs` 指向主臥；完整 `annotations` 只有上述兩筆整戶尺寸，沒有床邊通道、櫃前空間或家具尺寸。正式清單 `checklist.questions` 的四題分別索取房間淨尺寸、家具示意尺寸、門扇範圍、通道及衣櫃使用空間；第四步以 `question_ids` 引用同一四題。與[第三步](phase2-usable-space.md)及[清單查證](phase2-questions-and-print.md)一致。 |
| 原練習圖 | [原始描述](../../data/practice/bedroom-fragment.layout.json)與[生成 FloorPlan](../../data/practice/bedroom-fragment.floorplan.json)：臥室甲外框 `400 × 360 cm`，`14.4 m² ÷ 3.305785 = 4.36... 坪`，圖面顯示 `4.4 坪`。全片段的 `520/360 cm` 標註不在局部圖；房間／床淨尺寸與通道沒有標註。 |
| 第二張陌生圖 | [新原始描述](../../data/study/bedroom-transfer.layout.json)採**上下**分割的走道與臥室乙，床與書桌在左右，門在上、窗在下；與原練習的左右分割、床與衣櫃不同。[生成 FloorPlan](../../data/study/bedroom-transfer.floorplan.json) 中 `rooms[id=study-bedroom]` 外框 `500 × 315 cm`，`15.75 m² ÷ 3.305785 = 4.764... 坪`，圖面四捨五入為 `4.8 坪`。`annotations` 的 `500/420 cm` 是整個片段外牆牆心線尺寸，在讀者局部頁面不呈現。 |

生成器內部的 `inner`、家具長寬、門寬與留空規則只用於畫圖，不當成讀者已知資料或通用舒適門檻。第二張圖由原始描述經 `expand_layout.py` 生成，建置時 `scripts/validate_practice_floorplan.py` 重新展開比對並執行幾何驗證：**0 errors、0 warnings**。讀者頁使用同一 `FloorPlanRenderer` 和 `TeachingFigure`，不手繪另一套家具。

## 三題答案唯一性與清單語意

依 [練習內容](../../data/practice/interpretation-practice.json)逐題核對圖面已展示條件、三個選項及確認後才出現的理由；詳細推論見[三題校對](phase2-first-interpretation-question.md)。

| 題目 | 唯一成立選項 | 其餘選項的缺口 |
| --- | --- | --- |
| 有依據的結論 | `visible-and-unknown`：床與窗可見，淨長寬及家具尺寸仍待確認。 | `fits-own-bed` 缺個人床與房間尺寸；`passage-guaranteed` 把留白當成走動與開門保證。 |
| 尚缺的資訊 | `room-bed-and-clearance`：房間、示意床、個人床與床邊空間需可比較。 | `area-is-enough` 以 4.4 坪代替淨長寬；`window-only` 無法補足床與通道資料。 |
| 有效追問 | `ask-clear-dimensions`：要求臥室甲淨長、淨寬、量測位置與單位，對應第一個尺寸缺口。 | `ask-comfort` 未索取可核對資料；`ask-for-guarantee` 預設未成立的家具適用結論。 |

第三題正解文字由清單的 `room-clear-dimensions.practice_question` 投影；導讀第四步、螢幕清單與列印清單都來自同一組 `checklist.questions`。四題各有「為什麼問」，沒有將問題寫成適用評分或施工保證。

## 瀏覽器、列印與建置

- `npm ci` 後核對 Next.js **16.3.8**，`npm run build` 完成 28 個靜態頁面；新增 `/study/furniture-dimensions` 為靜態頁，設 `noindex`，不列於網站 sitemap 或一般導覽。
- 在真瀏覽器依主持流程演練首頁 → 四步導讀 → 原圖三題 → 四題清單 → 另一張局部圖；最後讀者頁只見示意圖與三項開放題，主持判準在獨立文件。這是流程演練，**不記作任何讀者結果**。
- `PORT=3107 npm test`：**362 passed**。其中新增的四項真瀏覽器檢查涵蓋第二張圖與 320 × 568、375 × 812、1280 × 900；既有的導讀、練習、清單列印、全圖、找找看、兩段式點擊、尺寸及 pan/zoom 回歸均包含於完整套件。Review 指出新圖的房名／面積在窄螢幕字級不足後，只調整試用頁的標籤：瀏覽器實測 320px 為 **12.5px**、375px 為 **15.2px**，並核對文字未遮住床的輪廓；共用圖面預設值未更動。
- Chromium A4 列印預覽為**一頁**；標題、適用範圍、四題及各題理由完整，頁首操作、header、footer 不在紙面。人工檢視[列印預覽](../../.scratch/phase2-furniture-dimensions/study/verification/checklist-print.png)，以及[320px 讀者頁](../../.scratch/phase2-furniture-dimensions/study/verification/reader-narrow.jpg)、[375px 讀者頁](../../.scratch/phase2-furniture-dimensions/study/verification/reader-mobile.jpg)與[桌面讀者頁](../../.scratch/phase2-furniture-dimensions/study/verification/reader-desktop.jpg)。

## 原定下一步（已由公開自填試用取代）

按[主持流程](../../.scratch/phase2-furniture-dimensions/study/moderator.md)為五位目標情境讀者各建一份[逐人紀錄](../../.scratch/phase2-furniture-dimensions/study/participant-record-template.md)，再填[五人彙總](../../.scratch/phase2-furniture-dimensions/study/cohort-summary-template.md)。同一位須在第二張未解過的圖上獨立完成觀察、未知資訊與對應追問；至少四位達標，且反覆誤解修正重測後，才可判定人工教學驗收通過。現在沒有這五份真實結果或招募日期。
