# 04: 完成四筆 CNS 轉載查證

**What to build:** 讓讀者在馬桶、洗手台、廚具與浴缸的 Symbol 頁看到可追溯且不誤導的轉載出處，並讓這四筆資料依本站流程誠實完成查證，而不宣稱直接看過 CNS 原文。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 逐筆核對公會規範表 14 的標題、項目與頁碼；把現有錯指 p32 的定位修正為實際承載「引用 CNS11567」聲明的位置
- [x] 四筆資料維持 `source_tier=cns`，不因未購買 CNS 而改成 convention
- [x] 每一筆至少有一個 `via`，清楚說明透過哪份公會文件得知內容且未核對 CNS 原文
- [x] 每一筆填入實際完成查證的日期與查證者，並將查證狀態改為 `verified`
- [x] 不加入看似來自 CNS 原文、但實際未見過的條次、引文或版本推論
- [x] Symbol 頁完整印出每筆出處及 `via`，讀者不會誤解為本站直接引用 CNS
- [x] Build-time validator 通過四筆 CNS 的 tier-specific 規則
- [x] 在內容或參考紀錄中保留「無法確認轉載與 CNS 最新版完全一致」的既有限制
