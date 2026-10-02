# 整理 FloorPlanViewer 的操作引導邏輯

Status: resolved

Spec: ../spec.md

## 問題與範圍

使用者要求 subagent review `FloorPlanViewer.tsx` 的可維護性與易讀性，並授權依建議修正、commit、push。Review 指出新增的試點選擇與動作選擇散在 render body，且 `dispatchViewer` 的輸入方式參數與同名區域變數具有不同語意。

## 驗收

- 用同檔具名純函式與 early return 表達試點熱區和引導動作的優先順序。
- 輸入方式在 dispatch 開頭集中推導，候選與確認事件共用；保留 SELECT_HOTSPOT 的鍵盤語意。
- 待處理焦點 ref 的命名明確表達一次性請求，候選渲染完成後才搬移焦點。
- 網址符號優先、閱讀順序門窗 fallback、真實 TAP、單一 action slot 與高度穩定等既有行為不變。
- 沿用 spec 已定案的瀏覽器頁面 seam；typecheck、完整測試與 PR release gate 通過。

## Comments

- 2026-10-03：使用者確認 review 目標是 Viewer，並要求依建議修正後 commit、push。Guide 呈現不在本票範圍。
- 模組設計：選擇策略留在 Viewer 檔案內的具名函式；執行 TAP、清除提示與 DOM 焦點 effect 仍由自由看圖 owner 負責。
- 實作：`pickStarterHotspot` 與 `getGuideAction` 依序 early return；`requestedInputMethod` 在 dispatch 開頭推導一次有效輸入方式；`pendingStarterFocusId` 保留候選渲染後的一次性焦點交接。
- 驗證：typecheck 通過；引導、Analytics、鍵盤、pan/zoom、InfoSheet 的 50 項相關測試通過；正式 SSG build 與資料驗證後，完整 Playwright 311 項通過。Standards 與 Spec 第二輪 review 各 0 項發現。
- Knowledge update：沒有新增 domain 詞彙、改變視覺語言或推翻 ADR，記錄保留於本票。
