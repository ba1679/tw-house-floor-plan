# 07: React 圖面 renderer

**What to build:** 檢視器自己讀 floorplan JSON 把圖畫出來，不再顯示 `render_svg.py` 的產物。
`data/layouts/*.svg` 回到它原本的身分——產生器的冒煙測試，證明 JSON 畫得出來——而不是正式站的圖面。

這張票不是為了讓程式碼好看。它解的是一件現在做不到的事：**圖面依互動狀態改變畫法。**
M4 找找看要把某個房間整個變暗、依 symbol 類別重新著色，而產物是一坨靜態 markup，改不了。

**Blocked by:** 01（專案骨架與靜態平面圖）

**Status:** done

**不在 M2 的完成定義裡**——M2 驗收的是「圖上任一符號都能在兩段式內選到」，那件事現在的圖面做得到。
排這張票的時機由 M4 或設計稿定案來決定，見 `docs/adr/0002-viewer-renders-the-generated-svg.md`。

背景：`render_svg.py` 的 docstring 自己寫著「這支是冒煙測試 renderer……正式站上的 React
`<FloorPlanRenderer>` 應該讀同一份 JSON，畫法可以不同，但不得反過來修改 JSON」。
SKILL.md 也說這個 skill 是「M2 的製圖工具……而不是另一條產品線」。
**「畫法可以不同」是明講的**——這張票不是要複製 `render_svg.py` 的每一條線。

- [x] `<FloorPlanRenderer>` 讀 `floorplan.json` 畫出牆、房間、門（含開啟弧線）、窗、傢俱、柱、雨遮、尺寸標註
- [x] 畫法依據《室內設計裝修製圖規範》，線寬階層照 `render_svg.py` 的 `LW`（表 24，已換算成 cm）
- [x] SVG 座標 = 世界座標（cm），與 `hotspot.coords` 同一個座標系，疊上去不需要換算
- [x] 圖面可依 hotspot 的互動狀態改變畫法——這是這張票存在的理由，至少要示範得出一種（例如把某個房間變暗）
- [x] `lib/floorplan/artwork.ts` 與 `validate_data.py` 裡「重跑產生器逐字比對」的檢查一起移除，
      `data/layouts/*.svg` 是否還要 commit 進 repo 一併決定
- [x] `docs/adr/0002` 標為 superseded，寫一份新的 ADR 說明推翻的理由
- [x] 測試涵蓋：頁面上量得出圖面尺寸（沿用 01 的那組）；某個房間在指定狀態下確實換了畫法
- [x] PRD §12 記的「sprite 與 `render_svg.py` 在衛浴廚具 4 個符號畫法不一致」要一併確認新 renderer 站哪一邊

---

## 做出來的東西

- `components/FloorPlanRenderer.tsx` —— 圖面。它讀 floorplan JSON，畫出 `<svg>` 並把
  熱區層以 children 接進來。取代了 `components/FloorPlanView.tsx`（已刪）。
- `components/FloorPlanRenderer.module.css` —— **只有顏色**。畫法要能依狀態改變，
  而 CSS 正是做這件事的地方。
- `lib/floorplan/drawing.ts` —— **只有幾何與製圖常數**：線寬階層（表 24）、圖層代號（表 23）、
  空間代號（表 25）、viewBox 與留白、牆／開口／傢俱的座標系、弧的 sweep-flag。
- `lib/floorplan/types.ts` —— 讀取範圍從熱區擴張到牆、門、窗、傢俱、柱、雨遮。
- `lib/floorplan/reading-order.ts` —— 多一個 `roomOfHotspot`：房間歸屬只有一份答案，
  不把 `assignRoom` 再跑一次。
- 刪除：`lib/floorplan/artwork.ts`、`components/FloorPlanView.tsx`、
  `data/layouts/3b2l_standard.svg`、`validate_data.py` 的逐字比對、
  `tests/build-validation.spec.ts` 的兩條同步測試與那份重複的 `RENDERER` 路徑常數。

## 決議

**`data/layouts/*.svg` 不再 commit。** 它沒有讀者了：網站不讀，而產生器自己的冒煙測試
有自己的產物（`.claude/skills/floorplan-generator/examples/out/*.svg`，`run_examples.py` 產生、
也 commit 在 repo 裡）。留一個沒有讀者、又沒有檢查把關的檔案，正是 ADR-0002 花一整條規則去防的
那種過期。要看產生器怎麼畫這張圖，跑一行就有（指令記在 ADR-0005）。

**PRD §12 的 4 個符號：新 renderer 站 sprite 那一邊**，照 p32 表 14 畫。
PRD 當時記的修法就是「把 renderer 補齊到表 14，不是把 sprite 改簡略」；
這裡補的是新的那支。額外的證據：浴缸的符號說明本來就寫著「裡面再套一個圓角長方形，
一端的小圓是排水孔」——在產物那條路上，那句話在圖上找不到對應。

**狀態驅動畫法的第一個用途**：說明卡開著時，沒被選到的房間暗下去。
說明卡是版面裡的一格（票 03），它升起來就把平面圖壓成一條可視帶；在那條帶子裡
「我現在看的東西在哪一間」是最容易掉的一件事。`roomStates` 這個 prop 就是 M4 找找看
「把某個房間整個變暗」要用的同一條路。

## 順手修掉的

`FloorPlanViewer.module.css` 裡的 `.canvas .floorplan` 從來沒有生效過——它寫在 CSS Module 裡，
選的卻是 `FloorPlanView` 用字串寫死的 `className="floorplan"`，兩邊的 hash 對不上。
圖面的尺寸規則現在在 `FloorPlanRenderer.module.css` 自己身上。

## Review 之後補的

1. **效能**：平移的每次 pointermove 都會讓檢視器重畫一輪，而圖面有近三百個元素。
   換掉產物之前那是一個 `dangerouslySetInnerHTML` 的 `<g>`、React 從來不碰；換成 React
   之後變成每幀 reconcile 一次。圖面抽成 memo 過的 `PlanArtwork`，`roomStates` 也 `useMemo`
   住讓它擋得住。熱區層留在外面當 children——它本來就該每輪都變。
2. **少一個欄位的後果變了**：從前是「圖面過期、畫面上看不出來」，現在是 build 死在 renderer 裡，
   而那個 TypeError 不會說是哪一份檔案、哪一間房。`validate_data.py` 接手把 renderer 會直接
   取用的欄位擋在建置之前（bounds、room 的 geometry 與 area_ping、wall 的端點、開口的 wall_id
   指得到牆、傢俱的 geometry 與 rotation、annotation 的端點），訊息裡帶檔名與 id。
   這條剛好補上被移除的那條同步檢查留下的空位。
3. **傢俱朝向不再四捨五入**：`fixtureFrame` 原本把任何角度吸附到最近的 90 度——45 度會被畫成
   90 度，看起來像一個正常的朝向，只是錯的。現在認不得就退回 0（看得出「這件沒轉」），
   真正的守門人是上面那條驗證。
4. **id 不加 floorplan 前綴是決定，不是疏漏**，理由與代價（一份文件只放得下一張圖）
   寫在 `FloorPlanRenderer.tsx` 的檔頭。遮罩 id 例外，因為 `url(#…)` 的參照是全文件的。
