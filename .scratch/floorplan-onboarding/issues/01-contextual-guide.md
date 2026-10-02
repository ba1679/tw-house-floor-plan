# 讓初次進入平面圖的人知道可以點、接著怎麼做

Status: resolved

Spec: ../spec.md

## 驗收

- 圖旁有常駐兩段操作提示與藍框圖例，圖面仍為主體。
- 試點按鈕進入真實的候選階段；第二次確認才打開說明。
- 回訪、拖動與鍵盤操作有清楚的下一步。
- 符號網址高亮、InfoSheet、找找看與事件不退步，窄／矮螢幕不產生 document scroll。

## Comments

- 2026-10-02：使用者選擇圖旁提示＋可試點的起點。保留品牌語言與既有兩段式選取。
- 實作：常駐兩段操作提示、真實熱區試點與鍵盤焦點接續；試點／重選／回到全圖共用控制位置，避免縮放時新增列造成倍率跳動。符號入口沿用網址高亮。
- 驗證：typecheck 通過；正式 SSG build 與資料驗證通過；完整 Playwright 套件 311 項通過。涵蓋手機、窄／矮螢幕、桌機、鍵盤、localStorage 被封鎖與既有 pan/zoom／InfoSheet／找找看／Analytics 行為。
- Knowledge update：`DESIGN.md` 記錄操作提示與控制位置規則。沒有新增 domain 詞彙或推翻 ADR。
