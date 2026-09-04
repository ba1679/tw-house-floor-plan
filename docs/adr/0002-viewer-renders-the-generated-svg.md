---
status: accepted
date: 2026-09-02
---

# 檢視器顯示產生器畫好的圖面產物，React renderer 延後

`data/layouts/*.svg` 是 floorplan-generator（`.claude/skills/floorplan-generator/scripts/render_svg.py`）
從 floorplan 資料畫出來、commit 進 repo 的產物。Next.js 檢視器在 build 時把它讀進來當圖面，
**只有熱區層**由檢視器自己依 `floorplan.hotspots` 畫。
PRD §10.1 的 `Layout Data → SVG Renderer → Hotspot Layer` 這條分層仍然成立，
差別在 SVG Renderer 這一段跑在資料產生的時候，不是跑在網站的 build 裡。

**這是一個明確的延後，不是終局。** 產生器自己的 docstring 寫著
「這支是冒煙測試 renderer……正式站上的 React `<FloorPlanRenderer>` 應該讀同一份 JSON，畫法可以不同」，
SKILL.md 也說這個 skill 是「M2 的製圖工具……而不是另一條產品線」。
換句話說，**本 ADR 選的路與產生器寫下的意圖相反**，理由是時機而不是架構：
M2 要先把兩段式點擊做出來，圖面好不好看不是 M2 的問題。
React renderer 已開成獨立的票（`.scratch/m2-viewer/issues/07-react-floorplan-renderer.md`）。

## 為什麼這值得寫下來

因為票 01 寫的是「由 floorplan 資料在 build 時渲染出來的真圖」，字面上讀起來像要在 TS 裡寫渲染器，
而這裡選了另一種讀法；也因為這個決定跟產生器的意圖相反，看到的人有權知道那是清醒的選擇。

真正的理由只有一個：**M2 的價值不在圖畫得多好，在點得到符號。**
現在寫 React renderer，要在票 02 之前先花掉一整張票的時間去重畫門的開啟弧線、傢俱、尺寸標註，
換來的是一張看起來跟現在幾乎一樣的圖。那個順序把最不確定的事（兩段式點擊在真機上到底行不行）
排到了最後面。

次要理由：同一份東西畫兩次會分岔，而這在本 repo 已經發生過一次——
PRD §12 記著 sprite 與 `render_svg.py` 在衛浴廚具 4 個符號上畫法不一致。
不過產生器把「畫法可以不同」寫在自己的 docstring 裡，代表它不認為分岔是錯的：
**JSON 才是 source of truth，兩個 renderer 對同一份 JSON 的畫法本來就可以不同。**
所以這條理由的份量比排序理由輕，別拿它來擋票 07。

## 考慮過的替代方案

1. **現在就寫 React renderer**：產生器與 PRD §10.1 的原意。放棄的是時機，不是方向；已開成票 07。
2. **prebuild 直接重跑產生器產生 SVG**（`data/layouts/*.svg` 不再 commit，改成建置產物）：
   字面上完全滿足「build 時渲染」，也不需要同步檢查。放棄的理由是它讓 Next.js 的建置
   長期依賴 `.claude/skills/` 這個路徑——那是 Claude Code 的 skill 目錄，不是產品的建置管線。
   而且產物不進 repo 之後，「這張圖現在長什麼樣」就 review 不到了。
3. **`<img src="...svg">`**：最省事，但熱區層要跟圖面在同一個座標系、同一個 CSS transform 底下，
   而且 `<img>` 裡的 SVG 拿不到 DOM。票 02 的兩段式點擊直接排除這個選項。

## 後果

- **產物會過期，而且畫面上看不出來**：圖上的門在這邊、可點的地方在那邊。
  因此 `validate_data.py` 在 build 前**把產生器重跑一次，與 commit 進 repo 的 SVG 逐字比對**
  （產出是可重現的，實測一致）。有人手改了 SVG、或改了 floorplan 卻忘記重跑產生器，兩個方向都擋得住，
  錯誤訊息直接附上修復指令。這條檢查因此讓網站的建置依賴 `.claude/skills/` 底下的產生器；
  產生器搬家時，`RENDERER` 這個常數要跟著改——**兩處**：`scripts/validate_data.py`
  與 `tests/build-validation.spec.ts`（後者要重跑產生器才驗得出 `symbol_id` 為 null 的案子）。
  一邊 Python 一邊 TS，沒有共用的辦法，所以清單記在這裡。
- **產物裡的 `<g id="hotspots">` 在渲染時被拿掉**（`lib/floorplan/artwork.ts`）。
  熱區層必須由檢視器自己畫，才管得到 `symbol_id` 為 null 要略過、命中優先序、焦點狀態這些事；
  留著產物那一份只會讓同一組 id 在 DOM 裡出現兩次。
- **改圖的流程是兩步**：改 layout → 重跑產生器 → commit 新的 `.json` 與 `.svg`。忘了第二步 build 會擋。
- **圖面樣式（顏色、線寬）不在網站的控制之下**，而且那是一支自稱「冒煙測試」的 renderer 的審美。
  M2 接受這件事；不接受的那天就是做票 07 的那天。

## 什麼情況下該推翻它

- **圖面需要依互動狀態改變畫法**——M4 找找看要把某個房間整個變暗、或依 symbol 類別重新著色。
  產物是一坨靜態 markup，做不到這種事。**這是最可能先到的那個理由。**
- 圖面本身的品質變成產品問題（設計稿定案、要換配色或線寬階層）。
- 兩段式點擊已經穩了，票 07 排得進來。
