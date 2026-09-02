# 01: 專案骨架與靜態平面圖

**What to build:** 使用者打開 `/layouts/3b2l_standard`，看到完整的三房兩廳平面圖。圖是靜態的——還不能點、不能縮放——但它是由 floorplan 資料在 build 時渲染出來的真圖，不是截圖。同時，任何人把資料改壞（重複 id、斷掉的 symbol 參照、floorplan 與 layout 不同步）時 build 會直接失敗，壞資料進不了正式站。

這是 M2 的第一顆曳光彈：一條窄但完整的路徑，從資料檔穿過建置驗證、路由、渲染，到一個真的在瀏覽器裡跑的測試。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Next.js（App Router）+ TypeScript 專案可 build、可跑 dev server
- [x] 路由 `/layouts/[id]` 以 SSG 產出，**以 layout（格局）id 定址**，渲染的是該 layout 展開出的 floorplan（PRD §8）
- [x] 路由不得寫死 `3b2l_standard`；第二張圖只需加資料檔，不必改程式
- [x] floorplan 資料與 symbol 資料在 build 時讀入，執行期不打 API、不連資料庫 —— **floorplan 已做；symbol 資料 01 沒有任何畫面會讀它，隨 03 說明卡一起落地**
- [x] `scripts/validate_data.py` 掛成 prebuild step，非零退出即中斷建置（維持 Python，不移植成 TS）
- [x] 刻意改壞一筆資料能讓 build 失敗，改回來能過
- [x] 平面圖 SVG 正確顯示在手機寬度（375px）下，不溢出、不橫向捲動
- [x] 瀏覽器測試 harness 就位（真實瀏覽器，非 jsdom——jsdom 的 `getBoundingClientRect` 回傳全零，量不出版面尺寸）
- [x] 至少一個通過的測試：打開頁面，斷言平面圖存在且量得出非零尺寸

## Comments

**2026-09-02 — 實作完成。**

- Next.js 16（App Router、Turbopack）+ React 19 + TypeScript，`output: "export"`：
  SSG 不是靠自律，是靠建置設定——任何需要執行期運算的頁面在 export 底下直接 build 失敗。
  `npm start` 因此改成用 `scripts/serve-static.mjs` 託管 `out/`，測試打的也是這份靜態產物。
- **圖面沿用 floorplan-generator 的產物 `data/layouts/*.svg`，沒有在 TS 裡重寫渲染。**
  理由與後果寫在 `docs/adr/0002-viewer-renders-the-generated-svg.md`。
  票面「由 floorplan 資料在 build 時渲染出來的真圖」的「build 時渲染」因此改成「build 時讀入產物」，
  資料驅動與可定址（DOM 裡有 `#room-master`、`#wall-001`）都仍然成立。
- 因為改成吃產物，`validate_data.py` 多了一條檢查：SVG 的 `<g id="hotspots">` 必須與 floorplan
  的 hotspots 逐筆對得上，否則中斷建置。產物過期在畫面上看不出來，只能靠 build 擋。
- 產物裡的 `<g id="hotspots">` 在渲染時被剝掉，熱區層留給 02 依 floorplan 資料自己畫。
- `next dev` 預設會往 `CLAUDE.md` 追加一段自己的說明；已在 `next.config.ts` 設 `agentRules: false` 關掉。
- 測試：Playwright + Chromium，viewport 375×812、`hasTouch`。10 passed。
  webServer 跑的是 `npm run build && npm run start`，所以 prebuild 的資料驗證每次測試都會被走過。
- 手動驗證：改壞一筆 `hotspot.symbol_id` → `npm run build` exit 1 且沒有產出 `out/`；改回來 exit 0。

**2026-09-02 — code review 後的修正。**

- **`overflow-x: hidden` 從 `html, body` 拿掉。** 它讓「不橫向捲動」那條測試變成永遠會過：
  根元素設了 hidden 之後 `scrollWidth` 永遠等於 `clientWidth`，再寬的東西也量不出來。
  拿掉之後補驗過：塞一個 2000px 的元素進頁面，那條測試真的會紅。而且這種裁切會跟 04 的 pan/zoom 打架。
- **同步檢查從只比熱區擴到房間／柱／雨遮**（20 個元素）。熱區同步不保證圖面本身沒走位。
  牆、門、窗刻意不比——它們在圖上是 render_svg.py 算出來的，比對等於把產生器的算法抄一遍。
- **檔名與 `floorplan.id` 一致的檢查從 TS 移進 `validate_data.py`**：資料檢查維持 Python 一份（spec 的決定）。
- 命名對齊 `CONTEXT.md`：`PlanArtwork`／`PlanBundle` → `FloorPlanArtwork`／`FloorPlanBundle`，
  `plan-artwork.ts` → `artwork.ts`。「圖面」這個詞已補進 `CONTEXT.md`。
- `types.ts` 刪掉沒人讀的 `Room` 與 `Hotspot`——熱區的型別等 02 真的畫熱區層時再依命中判定的需要來定。
- 測試 fixture 不再綁死屬性順序，並加上「fixture 真的改到東西」的斷言，避免變成一路綠燈卻什麼都沒測。

**2026-09-02 — 修正一個錯誤前提。**

我先前查的是家目錄的 `~/.claude`，因此在 ADR 0002 裡寫下「`render_svg.py` 不在這個 repo 裡」——**那是錯的**。
產生器就在 `.claude/skills/floorplan-generator/scripts/`，`expand_layout.py` 與 `render_svg.py` 都在。
連帶三件事跟著改：

- **守門從 proxy 換成逐字比對。** 原本只比房間／柱／雨遮／熱區的座標，補不到門窗牆。
  現在 `validate_data.py` 在 build 前把產生器重跑一次、與 commit 的 SVG 逐字 diff（產出實測可重現）。
  手改 SVG、或改了 floorplan 沒重跑產生器，兩個方向都擋得住，錯誤訊息附修復指令。
- **ADR 0002 重寫。** 原本的第一條理由（產生器不在 repo）作廢；真正的理由是排序——
  M2 的價值在點得到符號，不在圖畫得多好。同時記下這個決定與產生器 docstring 的意圖相反。
- **開了票 07（React 圖面 renderer）**，不列入 M2 完成定義；M4 找找看要讓房間變暗時它會變成必要。

