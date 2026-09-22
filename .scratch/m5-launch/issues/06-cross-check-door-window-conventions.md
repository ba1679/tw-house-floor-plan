# 06: 完成門窗類 convention 交叉查證

**What to build:** 讓單扇門、雙扇門、推拉門、出入口與窗各自具有第二份獨立可信出處，使最常出現在 FloorPlan 上的門窗說法不再只依賴單一文件。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 對五個門窗 Symbol 逐一閱讀候選來源原文；搜尋摘要、轉述文章或同一 PDF 的不同網址不算第二來源
- [x] 每個 Symbol 至少有兩筆 `doc` 不同、彼此獨立且可信的出處
- [x] 來源必須實際支持圖形或製圖語意；只談產品種類、裝修選購或建築口語的文章不能當畫法佐證
- [x] 若來源對開啟方向、門扇數、滑動表示或無門扇開口的畫法分歧，不得硬標 `verified`；記錄差異並採適當狀態
- [x] 完成者填入實際查證日期與查證者，並將符合流程的資料改為 `verified`
- [x] Source Tier 維持 `convention`，不把知道 CNS 可能有明文誤寫成已核對 CNS
- [x] 研究依據與判斷整理成可追溯的專案 reference
- [x] Symbol 頁顯示新增出處，且搜尋別名、分類清單、Symbol Art 與 FloorPlan 熱區仍使用同一個 Symbol
- [x] Build-time validator 對五筆資料通過 convention 的雙來源結構檢查
