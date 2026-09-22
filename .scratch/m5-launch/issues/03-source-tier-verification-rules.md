# 03: 擴充 Source Tier 查證規則

**What to build:** 讓內容維護者一旦把 Symbol 標成 `verified`，build-time validator 就能依它的 Source Tier 判斷查證紀錄是否真的走到本站定義的流程終點，而不是只看到一個狀態字串就放行。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 保留所有 `verified` 都必須有白話意思、出處、查證日期與查證者的通用條件
- [x] `cns + verified` 至少要有一筆非空 `via`，揭露轉載來源與未核對標準原文
- [x] `convention + verified` 至少要有兩筆 `doc` 不同的出處；兩筆同名文件不得冒充交叉來源
- [x] `regulation + verified` 至少要有一筆可解析的 HTTPS URL 與定位資訊；錯誤訊息說明官方性仍由查證者人工負責
- [x] `caution` 維持不屬於查證完備性；`caution = null` 的 Symbol 只要其他條件齊全仍可 `verified`
- [x] 每一種失敗訊息都帶 Symbol id、Source Tier、缺少的條件與修正方向
- [x] 使用暫存資料分別驗證 CNS 缺 `via`、convention 只有一份／兩份同名文件、regulation 缺 URL／定位資訊會失敗
- [x] 使用暫存資料驗證三種 Source Tier 在條件齊全時會通過
- [x] 本票不把 80% 改成硬 gate；真資料仍可在 1/14 時完成 build，門檻只維持報告，避免 expand 階段讓整個專案全紅
