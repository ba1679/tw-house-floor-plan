# 07: React 圖面 renderer

**What to build:** 檢視器自己讀 floorplan JSON 把圖畫出來，不再顯示 `render_svg.py` 的產物。
`data/layouts/*.svg` 回到它原本的身分——產生器的冒煙測試，證明 JSON 畫得出來——而不是正式站的圖面。

這張票不是為了讓程式碼好看。它解的是一件現在做不到的事：**圖面依互動狀態改變畫法。**
M4 找找看要把某個房間整個變暗、依 symbol 類別重新著色，而產物是一坨靜態 markup，改不了。

**Blocked by:** 01（專案骨架與靜態平面圖）

**Status:** ready-for-agent

**不在 M2 的完成定義裡**——M2 驗收的是「圖上任一符號都能在兩段式內選到」，那件事現在的圖面做得到。
排這張票的時機由 M4 或設計稿定案來決定，見 `docs/adr/0002-viewer-renders-the-generated-svg.md`。

背景：`render_svg.py` 的 docstring 自己寫著「這支是冒煙測試 renderer……正式站上的 React
`<FloorPlanRenderer>` 應該讀同一份 JSON，畫法可以不同，但不得反過來修改 JSON」。
SKILL.md 也說這個 skill 是「M2 的製圖工具……而不是另一條產品線」。
**「畫法可以不同」是明講的**——這張票不是要複製 `render_svg.py` 的每一條線。

- [ ] `<FloorPlanRenderer>` 讀 `floorplan.json` 畫出牆、房間、門（含開啟弧線）、窗、傢俱、柱、雨遮、尺寸標註
- [ ] 畫法依據《室內設計裝修製圖規範》，線寬階層照 `render_svg.py` 的 `LW`（表 24，已換算成 cm）
- [ ] SVG 座標 = 世界座標（cm），與 `hotspot.coords` 同一個座標系，疊上去不需要換算
- [ ] 圖面可依 hotspot 的互動狀態改變畫法——這是這張票存在的理由，至少要示範得出一種（例如把某個房間變暗）
- [ ] `lib/floorplan/artwork.ts` 與 `validate_data.py` 裡「重跑產生器逐字比對」的檢查一起移除，
      `data/layouts/*.svg` 是否還要 commit 進 repo 一併決定
- [ ] `docs/adr/0002` 標為 superseded，寫一份新的 ADR 說明推翻的理由
- [ ] 測試涵蓋：頁面上量得出圖面尺寸（沿用 01 的那組）；某個房間在指定狀態下確實換了畫法
- [ ] PRD §12 記的「sprite 與 `render_svg.py` 在衛浴廚具 4 個符號畫法不一致」要一併確認新 renderer 站哪一邊
