# 修正說明卡鍵盤測試的冷啟動時序

Status: resolved

Spec: ../spec.md

## 問題

PR #14 的 release gate 在 375 × 812 說明卡測試失敗，310 項通過。測試在靜態 HTML 載入後立刻聚焦並送出 Enter，尚未等待 client 接手；首次實際寬度的 RESIZE 會依既有 contract 清除選取，讓剛開啟的說明卡消失。

## 驗收

- 沿用已定案的真實瀏覽器頁面 seam，在慢速冷啟動下仍能用鍵盤開啟說明卡、展開內容並保留圖面可視帶。
- 使用既有 client 就緒訊號等待，不增加固定延遲或重試。
- 保留既有 RESIZE 與鍵盤互動 contract。
- Typecheck、完整 Playwright 與 PR release gate 通過。

## Comments

- 2026-10-03：一般速度重跑 10 次全過；8 倍 CPU 降速重現 8/8。事件探針觀察到 Enter 後 confirmed → browsing，排除純粹未綁定 handler；等待既有 data-hint client 訊號後同樣降速 4/4 通過。
- 回歸：把 8 倍 CPU 降速保留在原有兩種手機尺寸測試。加入就緒等待前，375 × 812 測試穩定失敗；加入後兩種尺寸連跑共 10 次通過。既有焦點、展開、控制元件與可視帶斷言全部保留。
- 驗證：typecheck 通過；`CI=1 PORT=3001 npm test` 包含正式 SSG build 與資料驗證，311 項通過。Standards 與 Spec review 各 0 項發現。
- 完整套件第一輪另捕捉到 pan/zoom 展開後點擊測試一次失敗。單項 10 次與 8 worker 並行 25 次均通過，尚未確認原因；完整套件第二輪通過。沒有足夠重現證據，因此保留該測試原樣。
- 探針與試驗樣式已清除；知識更新只記錄測試時序，沒有新增 domain 詞彙或改變 ADR。
