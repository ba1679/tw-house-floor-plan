---
status: accepted
date: 2026-09-11
supersedes: 0002-viewer-renders-the-generated-svg.md
---

# 檢視器自己讀 floorplan JSON 把圖畫出來

`components/FloorPlanRenderer.tsx` 讀 `data/layouts/*.floorplan.json`，在 React 裡畫出牆、房間、
門（含開啟弧）、窗、傢俱、柱、雨遮、尺寸標註與圖名。幾何與製圖常數在 `lib/floorplan/drawing.ts`，
顏色在 `FloorPlanRenderer.module.css`。SVG 座標仍然是世界座標 cm，熱區層疊上去不需要換算。

**本 ADR 推翻 `docs/adr/0002`。** 那份 ADR 選的是「顯示 floorplan-generator 畫好、commit 進 repo
的 `data/layouts/*.svg`」，而它自己寫著這是「一個明確的延後，不是終局」，並且把推翻的條件列在最後：

> **圖面需要依互動狀態改變畫法**——M4 找找看要把某個房間整個變暗、或依 symbol 類別重新著色。
> 產物是一坨靜態 markup，做不到這種事。**這是最可能先到的那個理由。**

先到的就是它。

## 為什麼這值得寫下來

因為 0002 寫得夠有說服力，而這份 diff 看起來像在拆掉它。看到的人有權知道拆的是哪一條理由。

0002 的核心論證是**排序**：M2 的價值在「點得到符號」，不在圖畫得多好，所以先做兩段式點擊。
那個論證到今天仍然成立，而且已經兌現——票 02 到 06 做完了，兩段式在真機上行得通。
本 ADR 不反對那個排序，它只是走到了排序的下一格。

換掉之後多出來的那件事只有一件，但它是整張票的理由：**圖面可以依互動狀態改變畫法。**
第一個用它的地方在 `FloorPlanViewer`——說明卡開著時，沒被選到的房間暗下去。
說明卡是版面裡的一格（`docs/adr/0003`），它升起來就把平面圖壓成一條可視帶；
在那條帶子裡「我現在看的東西在哪一間」是最容易掉的一件事。
這在產物那條路上做不到：`<g id="rooms">` 是一串固定的 `fill`，改不了。

M4 找找看要的「把某個房間整個變暗、依 symbol 類別重新著色」走的是同一條路——
`roomStates` 這個 prop 已經在那裡，加一個狀態值是 CSS 的一行。

## 這不是「把 render_svg.py 抄成 TypeScript」

產生器的 docstring 從第一天就寫著：

> 這支是「冒煙測試 renderer」……正式站上的 React `<FloorPlanRenderer>` 應該讀同一份 JSON，
> **畫法可以不同**，但不得反過來修改 JSON——JSON 是唯一 source of truth。

所以兩邊相同的是**依據**、不是**線條**：

- **相同**：座標系（世界座標 cm）、線寬階層（p47 表 24，`LW` × `LINE_SCALE`）、
  圖層代號（p46 表 23）、空間代號（p48 表 25）、開啟弧的幾何（由 `expand_layout.py` 算好放在
  `swing_arcs`，兩邊都不重算）、留白的算法（平開窗的弧與雨遮會伸出建物之外）。
- **不同，而且是刻意的**：
  1. **衛浴廚具 4 個符號照 p32 表 14 畫**（馬桶有水箱、洗臉盆有牆線與落水口、流理檯有洗槽、
     浴缸有內框與排水孔），與 `data/symbols.sprite.svg` 同一套。產生器一律簡化成橢圓或矩形。
     PRD §12 記著這筆帳，並且寫明「修法是把 renderer 補齊到表 14，不是把 sprite 改簡略」——
     這裡就是那個修法，只是補的是新的 renderer。**新 renderer 站 sprite 那一邊。**
     浴缸的符號說明本來就寫著「裡面再套一個圓角長方形，一端的小圓是排水孔」；
     在產物那條路上，那句話在圖上是找不到的。
  2. **門窗開口用遮罩挖牆，不是拿紙色矩形蓋掉**。真實平面圖上地板是穿過門口連續的；
     蓋掉會在每個開口留下一道白條。
  3. **顏色與幾何分家**：顏色進 CSS Module，因為畫法要能依狀態改變；
     線寬留在 TS，因為它是製圖依據，不是樣式。

## 後果

- **`lib/floorplan/artwork.ts` 沒了**，`FloorPlanArtwork` 這個型別也沒了。
  0002 記著的那個風險（產生器改掉 `<g id="hotspots">` 的名字，剝除會靜靜失效、
  DOM 裡出現兩組同名 id）隨之消失——現在熱區層只有一份。
- **`validate_data.py` 的「重跑產生器逐字比對」拿掉了**，網站的建置不再依賴 `.claude/skills/`。
  0002 的後果清單裡「`RENDERER` 這個常數要改兩處」那條也一併結案：兩處都沒了
  （`scripts/validate_data.py`、`tests/build-validation.spec.ts`）。
- **`data/layouts/3b2l_standard.svg` 從 repo 移除。** 它沒有讀者了：網站不讀，
  而產生器自己的冒煙測試有自己的產物（`.claude/skills/floorplan-generator/examples/out/*.svg`，
  `run_examples.py` 產生、也 commit 在 repo 裡）。留一個沒有讀者、又沒有檢查把關的檔案，
  正是 0002 花一整條規則去防的那種過期。要看產生器現在怎麼畫這張圖，跑一行就有：

      python3 .claude/skills/floorplan-generator/scripts/render_svg.py \
        data/layouts/3b2l_standard.floorplan.json -o /tmp/preview.svg

- **改圖從兩步變回一步**：改 layout → 重跑 `expand_layout.py` → commit 新的 `.json`。沒有第二個產物要同步。
- **圖面樣式回到網站的控制之下**。0002 的最後一條後果（「樣式不在網站的控制之下，
  而且那是一支自稱冒煙測試的 renderer 的審美」）失效。設計稿定案時改的是 CSS，不是 Python。
- **多出一份要維護的畫法**。這是真的成本：sprite、產生器、React renderer，同一件事有三個地方畫。
  0002 把這件事列為「次要理由」並說「別拿它來擋票 07」——照辦，但記下來：
  三者之中**只有 sprite 與 React renderer 需要一致**（PRD §12 的承諾是「符號頁認得的形狀，
  回到平面圖上找得到」），產生器是工具，它畫得簡略不影響任何使用者看到的東西。

## 什麼情況下該推翻它

- 設計稿要的圖面複雜到 React 畫不動（例如要疊材質貼圖、要 canvas 級的效能）。
  那時要換的是渲染技術，不是「回去顯示產物」。
- 有第二張、第三張格局圖之後，發現 `drawing.ts` 為了通用而扭曲。
  那是重構的訊號，不是這個決定的訊號。
