# 05: 完成結構類 convention 交叉查證

**What to build:** 讓牆、柱、樑與管道間不再只靠單一公會文件，而是各自具有第二份獨立可信出處，讀者能看出「業界慣例」的說法經過交叉核對。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] 對牆、柱、樑、管道間逐一閱讀候選來源原文；搜尋摘要、轉述文章或同一 PDF 的不同網址不算第二來源
- [ ] 優先查核正式製圖手冊、政府／公部門文件、專業公會或教育機構教材，但只有實際支持該 Symbol 說法的文件才能引用
- [ ] 每個 Symbol 至少有兩筆 `doc` 不同、彼此獨立且可信的出處
- [ ] 若兩份來源的畫法或定義分歧，不得硬標 `verified`；記錄差異並維持適當查證狀態或 Source Tier
- [ ] 完成者填入實際查證日期與查證者，並將符合流程的資料改為 `verified`
- [ ] Source Tier 維持 `convention`；交叉查證完成不會把它提升成 CNS 或 regulation
- [ ] 研究依據與判斷整理成可追溯的專案 reference，讓未來維護者不必重新找一次
- [ ] Symbol 頁顯示新增出處，且原有名稱、白話意思、Symbol Art 與轉換點沒有退步
- [ ] Build-time validator 對四筆資料通過 convention 的雙來源結構檢查
