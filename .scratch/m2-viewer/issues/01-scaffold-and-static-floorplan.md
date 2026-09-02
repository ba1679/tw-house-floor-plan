# 01: 專案骨架與靜態平面圖

**What to build:** 使用者打開 `/layouts/3b2l_standard`，看到完整的三房兩廳平面圖。圖是靜態的——還不能點、不能縮放——但它是由 floorplan 資料在 build 時渲染出來的真圖，不是截圖。同時，任何人把資料改壞（重複 id、斷掉的 symbol 參照、floorplan 與 layout 不同步）時 build 會直接失敗，壞資料進不了正式站。

這是 M2 的第一顆曳光彈：一條窄但完整的路徑，從資料檔穿過建置驗證、路由、渲染，到一個真的在瀏覽器裡跑的測試。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Next.js（App Router）+ TypeScript 專案可 build、可跑 dev server
- [ ] 路由 `/layouts/[id]` 以 SSG 產出，**以 layout（格局）id 定址**，渲染的是該 layout 展開出的 floorplan（PRD §8）
- [ ] 路由不得寫死 `3b2l_standard`；第二張圖只需加資料檔，不必改程式
- [ ] floorplan 資料與 symbol 資料在 build 時讀入，執行期不打 API、不連資料庫
- [ ] `scripts/validate_data.py` 掛成 prebuild step，非零退出即中斷建置（維持 Python，不移植成 TS）
- [ ] 刻意改壞一筆資料能讓 build 失敗，改回來能過
- [ ] 平面圖 SVG 正確顯示在手機寬度（375px）下，不溢出、不橫向捲動
- [ ] 瀏覽器測試 harness 就位（真實瀏覽器，非 jsdom——jsdom 的 `getBoundingClientRect` 回傳全零，量不出版面尺寸）
- [ ] 至少一個通過的測試：打開頁面，斷言平面圖存在且量得出非零尺寸
