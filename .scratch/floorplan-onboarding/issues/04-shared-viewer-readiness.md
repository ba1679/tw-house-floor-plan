# 共用互動測試的 client 就緒等待

Status: resolved

Spec: ../spec.md

## 問題

Viewer 重構的最新 CI（26b00bf）在既有 keyboard 的 Enter／Esc 焦點測試失敗，310 項通過。卡片內容與可見性斷言曾通過，隨後卡片消失；測試在 page.goto 後立刻 focus／Enter，沒有 client 就緒等待，與票 02 的冷啟動模式相同。

## 驗收

- 沿用既有 data-hint client 訊號，將等待收進 viewer-page 共用 helper。
- 鍵盤互動測試與兩段式選取都從 client 接手後開始；InfoSheet 與鍵盤試點沿用同一等待。
- 用較慢冷啟動保留 Enter／Esc 焦點回歸測試；不增加固定延遲或重試，不放寬原斷言。
- Typecheck、完整瀏覽器套件及最新 PR release gate 通過。

## Comments

- 2026-10-03：使用者的 CI 修正要求持續有效，Viewer 可讀性重構已獨立 commit、push，這一票只整理測試啟動時序。
- 回歸：原 Enter／Esc 測試在 8 倍 CPU 降速下 3/3 失敗；加入共用就緒等待後 5/5 通過，原焦點與內容斷言保留。
- 實作：`waitForViewerReady` 共用既有 data-hint client 訊號；鍵盤互動、鍵盤試點、InfoSheet 及兩段式選取沿用。兩段式 helper 的固定 100ms 等待已移除。
- 驗證：typecheck 通過；正式 SSG build 與資料驗證後，完整 Playwright 311 項通過。Standards 與 Spec review 各 0 項發現。
- Knowledge update：只有測試啟動時序改變，沒有新增 domain 詞彙、視覺改動或 ADR 決策。
