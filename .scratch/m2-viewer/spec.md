# M2 互動式平面圖檢視器

Status: ready-for-agent

來源：PRD `平面圖教學網站-PRD-Phase1.md` §6.1、§6.4、§6.5、§8、§9、§13（M2）
決議依據：PRD §11 #6、#15、#16、#19、#20、#21
原型（primary source）：分支 `prototype/two-stage-tap`，commit `4f18334`

---

## Problem Statement

首購族站在接待中心，手上拿到一張建案平面圖。圖上滿是記號——一段畫了弧線的開口、一個填了深灰的方塊、外牆邊一條長虛線——他知道這些記號有意義，但沒有人告訴他是什麼意義。銷售人員講的是坪數與付款方式，不是圖。

他能做的只有回家 Google「平面圖 符號」，得到一堆彼此矛盾、沒有出處的部落格文章。而他正要簽的是這輩子最大的一筆支出。

更麻煩的是，這件事發生在**手機上、現場、站著**。任何需要坐下來慢慢讀的東西都不會被用到。

## Solution

一張可以點的三房兩廳平面圖，網址 `/layouts/3b2l_standard`。

點圖上任何一個位置——不需要點準——圖會放大到 3× 並圈出附近的候選符號；再點一次確認要看哪一個，說明卡從螢幕底部升起，告訴他這是什麼、要注意什麼、**以及這個說法是從哪份文件來的**。

「不需要點準」是這個解法的核心。這張圖上 37 個熱區沒有一個滿足 44×44px 的觸控規格（最大的短邊只有 34.5px），把命中區放大到 44px 在數學上走不通——柱與相鄰窗的間距只有 3cm，命中區會互相吃掉。所以改成兩段式：第一段容錯、第二段確認。而第一段之後的那次放大，正好逼使用者多看一眼符號的線條——對一個教人辨認符號的網站，那是收穫不是成本。

## User Stories

1. As a 首購族, I want 打開網址就直接看到完整的三房兩廳平面圖, so that 我不必先讀說明或做選擇就能開始探索
2. As a 首購族, I want 一眼看出圖上哪些地方可以點, so that 我不會以為這只是一張靜態圖片而直接離開
3. As a 首購族, I want 點圖上的大略位置就能選到符號, so that 我不必用手指去戳一個比指尖還小的記號
4. As a 首購族, I want 第一段點擊後畫面自動放大, so that 我看得清楚那個記號實際長什麼樣
5. As a 首購族, I want 放大後看到候選符號被明確圈起來, so that 我知道接下來要在哪幾個之中選
6. As a 首購族, I want 第二段點擊確認我要看的那一個, so that 系統不會替我猜錯
7. As a 首購族, I want 在候選裡點到柱而不是壓在它上面的窗, so that 比較小的符號不會因為被大符號蓋住就永遠點不到
8. As a 首購族, I want 點到圖上沒有符號的空白處時得到提示而不是被莫名放大, so that 我不會迷失在一個沒有東西可看的畫面裡
9. As a 首購族, I want 隨時能按「重選」退回上一段, so that 選錯了不必重新整理頁面
10. As a 首購族, I want 看完一張說明卡後直接點圖上別的地方就能看下一個, so that 我不必每次都先按「重選」才能繼續
11. As a 首購族, I want 確認之後畫面回到原本的視野, so that 我不會失去「我剛剛點的是圖上哪個位置」的方向感
12. As a 首購族, I want 說明卡不佔滿整個螢幕, so that 我看說明的同時還看得到那個符號在圖上的位置
13. As a 首購族, I want 說明卡先給我一句白話意思, so that 我三秒內就知道那是什麼，不必讀完整段
14. As a 首購族, I want 把說明卡往上拉看完整內容, so that 注意事項被截斷時我知道下面還有東西
15. As a 首購族, I want 看到這個說法的來源徽章, so that 我知道這是國家標準、法規、業界慣例，還是根本畫法不一
16. As a 首購族, I want 知道「不同建商畫法可能不同」, so that 我不會拿這裡的說法去跟代銷吵架
17. As a 首購族, I want 知道這個符號在這張圖上共有幾處、我現在看的是第幾處, so that 我理解它是常見元素而不是特例
18. As a 首購族, I want 用雙指縮放與拖曳自由看圖, so that 我可以自己決定要細看哪一區
19. As a 首購族, I want 快速雙擊就能放大某一區, so that 我不必每次都用兩根手指
20. As a 首購族, I want 一鍵回到全圖, so that 放大之後迷路了可以重來
21. As a 首購族, I want 縮放有上下限, so that 我不會把圖縮成一個點或放大到只剩一條線
22. As a 第一次進站的使用者, I want 一句極輕量的引導告訴我可以點, so that 我知道這張圖是互動的
23. As a 回訪的使用者, I want 那句引導不要每次都出現, so that 它不會變成噪音
24. As a 手機使用者, I want 平移與縮放是順的, so that 這個網站在現場用得下去
25. As a 鍵盤使用者, I want 用 Tab 一間房一間房走過所有符號, so that 我不需要手指精度也能看完整張圖
26. As a 鍵盤使用者, I want 在同一個房間裡依結構→門窗→家具的順序走, so that 順序是可預期的而不是隨機跳
27. As a 鍵盤使用者, I want 按 Enter 開啟說明卡、按 Esc 關閉, so that 我不必用兩段式（我本來就沒有手指精度問題）
28. As a 讀螢幕的使用者, I want 每個熱區有替代文字, so that 我知道游標現在停在什麼符號上
29. As a 使用者, I want 說明卡的關閉鍵與「其他位置」列都夠大, so that 我點得到它們
30. As a 使用者, I want 免責聲明固定在說明卡最底不隨捲動消失, so that 我不會漏看
31. As a 內容維護者, I want 說明卡的文案全部來自 symbol 資料, so that 我改一次資料四個介面一起改
32. As a 內容維護者, I want 「共 N 處」由 floorplan 算出來, so that 我加減 hotspot 時不必回頭改文案
33. As a 內容維護者, I want 查證未完成的 hotspot 被檢視器安靜略過, so that M1 還沒做完也能先上線看圖
34. As a 開發者, I want 資料驗證失敗時 build 直接中斷, so that 壞掉的資料進不了正式站
35. As a 開發者, I want 新增第二張格局圖時不必改檢視器的程式碼, so that 圖的數量不是工程成本

## Implementation Decisions

### 路由與資料

- Next.js App Router + TypeScript，SSG。路由 `/layouts/[id]`，**以 layout（格局）id 定址**，頁面渲染的是該 layout 展開出的 floorplan（PRD §8）。階段一只有 `3b2l_standard` 一個 id，但路由不得寫死。
- 資料在 build 時讀入：`data/layouts/*.floorplan.json` 與 `data/symbols.sample.json`。執行期不打 API、不連資料庫。
- `scripts/validate_data.py` 掛成 prebuild step，非零退出即中斷建置（PRD §10.1）。**維持 Python，不移植成 TS**——它已經在跑、已經涵蓋 14 條檢查，重寫一次只會製造兩份會分岔的驗證。
- `hotspot.symbol_id` 為 `null` 者，檢視器**安靜略過**：不畫、不進候選、不計入「共 N 處」（PRD §7.3）。
- 「共 N 處」由 `floorplan.hotspots` 依 `symbol_id` 統計得出，**不得寫死**。

### 互動狀態機

檢視器的互動邏輯是一個純模組：`(state, action) => state`，不碰 DOM。原型（`prototype/two-stage-tap`）已驗證這個形狀可行，以下是它編碼的決策，比散文精確：

```ts
const TAP1_TOLERANCE_PX = 46;  // 第一段容錯半徑
const TAP2_TOLERANCE_PX = 30;  // 第二段「最近者」上限
const STAGE_ZOOM        = 3;   // 第一段之後的自動放大倍率

// 熱區命中優先序（§6.1.1）：面積小者優先。兩段都適用。
const bySmallestArea = (a, b) => areaCm2(a) - areaCm2(b);

// 單位規則：容錯半徑一律以 CSS px 定義，判定時依當前 scale 換算回圖面 cm
const pxToCm = (s, px) => px / scalePxPerCm(s);

function firstTap(s, x, y) {
  const tolCm = pxToCm(s, TAP1_TOLERANCE_PX);
  const cands = s.hotspots.filter(h => distCm(h,x,y) <= tolCm).sort(bySmallestArea);
  if (cands.length === 0) return { ...s, stage:'browsing' };  // 提示換位置，不放大
  return { ...s, stage:'candidates', candidates: cands,
           tolCmAtTap: tolCm,           // ← 存起來給繪製用，見下方「單位混淆的第二個發生點」
           savedView: s.savedView || s.view,
           view: { cx:x, cy:y, zoom: STAGE_ZOOM } };
}

function confirmTap(s, x, y) {
  const tolCm = pxToCm(s, TAP2_TOLERANCE_PX);        // 此時 scale 已是 3×
  const inside = s.candidates.filter(h => containsCm(h,x,y)).sort(bySmallestArea);
  let hit = inside[0];
  if (!hit) {                                         // 落在熱區外：取 30px 內最近者
    const near = s.candidates.map(h => ({h, d: distCm(h,x,y)}))
      .filter(o => o.d <= tolCm)
      .sort((a,b) => (a.d - b.d) || bySmallestArea(a.h, b.h));
    hit = near[0]?.h;
  }
  if (!hit) return { ...s };                          // 留在第二段，提示再試或重選
  return { ...s, stage:'confirmed', selected: hit, view: s.savedView };
}
```

三個狀態：`browsing`（可自由 pan/zoom）→ `candidates`（已放大、候選高亮）→ `confirmed`（說明卡開啟、視野已還原）。

- **第二段的命中只掃 `s.candidates`，不掃全部 37 個熱區**（決議 #19）。放大後新進視野的熱區若也能被選中，高亮就是騙人的。
- **`confirmed` 狀態下的 TAP 直接走 `firstTap`**（決議 #20）。「重選」是明確的退出鍵，不是看下一個符號的必經步驟。
- 46 / 30 / 3× 三個數字經原型實測不改（決議 #21）：全圖下第一段容錯 = 圖面 147cm 半徑，每 10cm 取樣 15,120 點的結果是落空 11%、中位數 3 個候選、最壞 9 個，而最壞的 9 個放大 3× 後在畫面上明顯分離。

### 座標換算

- **pan/zoom 用 CSS transform，不是每幀重設 SVG viewBox**（PRD §9 效能要求）。原型為求簡單用了 viewBox，**換算層必須重寫**，這是原型唯一不能直接搬的部分。
- 容錯半徑一律以 CSS px 存，判定時依當前縮放換算回圖面 cm。設計稿曾誤寫成「46 SVG 單位」（= 46cm，全圖下只有 14px，比手指還小）。
- **單位混淆的第二個發生點**：繪製第一段的容錯圈時，必須用命中判定當下存下的 `tolCmAtTap`，不能在放大後重算。原型自己踩過——重算後圈只有實際的三分之一，圈外的熱區也亮著，看起來像 bug。

### 說明卡（bottom sheet）

- 兩段高度：初始 392px（46%）、展開 660px（78%），上限是「平面圖僅餘 84px」——足夠維持位置感，不足以繼續操作（`design/Main.dc.html`）。**永遠不佔滿螢幕**。
- 欄位順序：符號名稱 → 分類 → 來源徽章 → 白話意思 → 注意事項 → 「這張圖上共 N 處 · 目前第 M 處」→ 免責聲明。
- 內容全部取自 symbol 資料，一字不在元件裡寫死。
- 來源徽章依 `source_tier` 四種（PRD §6.5）。**`source_tier` 與 `verification_status` 是兩條不同的軸，不可互相取代或合併顯示**（`CONTEXT.md`）。
- 免責聲明固定在最底、不隨捲動消失。關閉鍵與「其他位置」列 ≥ 44px。
- 桌機提供 hover 狀態；手機無 hover，靜態提示必須自身足夠明確。**不用 hover tooltip 承載說明內容。**

### 鍵盤與無障礙（解決 PRD §9 的 v0.5 未決）

- **閱讀順序：依房間，房間內依符號類別**（結構 → 門窗 → 家具家配）。對上「看屋時一間一間看」的心智模型，也和 §6.6「進度以 layout 為單位」一致。
- hotspot 的房間歸屬**在 build 時由 `floorplan.rooms` 的幾何算出，不改 floorplan schema**——floorplan 由程式產生、不得手改，加欄位就要動 `expand_layout.py` 與所有既有產物。歸屬取**重疊面積最大的那一間**；兩間各佔一半時（跨在走道與房間中間的門與開口）取**面積小的那一間**，門才會跟它服務的空間一起被讀到，而不是五扇門全堆在走道那一段。落在所有 room 之外者歸到幾何上最近的 room，並排在該房間的最後。
  - **落在所有 room 之外的只有 3 個雨遮。** 本文原先把「外牆、外側的窗」也算進去，實作時發現 `rooms[].geometry` 是**含牆厚**的外框，而外牆與外側的窗就畫在那條牆上——它們有一半落在房間的幾何裡，因此歸到自己所屬的房間（`hs-wall-exterior` → 主臥、`hs-win-living` → 客廳），不走「最近的 room」那條路。2026-09-10 依實作實測修訂，來龍去脈在票 06 的 comments。
- 鍵盤路徑**不走兩段式**：Tab 在熱區間移動、Enter 開說明卡、Esc 關閉。兩段式解的是手指精度問題，鍵盤沒有這個問題。
- 每個熱區有替代文字，內容為該 symbol 的 `name`。

### 可點擊性提示

- 首次進入顯示一次性引導，文案對上兩段式：「點圖上任何一個位置，我們會放大讓你看清楚」，出現後以 localStorage 記住。
- 熱區的視覺提示**非常克制**（微弱底色或極慢脈動），**不得持續閃爍**——這張圖本身是學習對象，干擾性動效會破壞辨識。

### 為 M4 預留的介面（現在不實作行為）

找找看的視野鎖定與機制自己的自動 3× 是**兩個開關**（決議，PRD §6.1.1）。狀態機現在就要有 `fitLocked` 這個輸入：它擋使用者發起的縮放，不擋 `firstTap` 的自動放大。M2 不接 UI，但介面留好，M4 才不必回頭改狀態機。

- **`fitLocked` 也不擋鍵盤焦點的自動平移**（票 06 的 `FOCUS_HOTSPOT`，2026-09-10 裁定）。同一條界線：擋的是使用者自己發起的縮放與平移，不是機制對使用者動作的回應——焦點已經落在那個熱區上，圖不跟過去的話，鍵盤使用者只會盯著一個看不到目標的畫面。
  M4 若要防「鍵盤玩家一路 Tab 過去看答案」，要處理的是**熱區的替代文字直接念出符號名字**這件事，不是這裡的平移；視野鎖定從來就擋不住它。

## Testing Decisions

**什麼是好的測試**：只測外部行為——使用者點在哪個 CSS 像素上、看到哪個熱區高亮、說明卡出現什麼字。不測 `reduce` 回傳的物件形狀、不測元件內部 state、不斷言 class 名稱以外的實作細節。

**單一 seam：頁面層，在真實瀏覽器裡驅動 `/layouts/[id]`。** 不另外替純模組開一組單元測試——由頁面測試間接覆蓋。

理由：已知的兩個 bug 都不在狀態機裡，而在 client px → 圖面座標的換算層（v0.5 的「46 SVG 單位」、原型的容錯圈用放大後半徑重算）。只測純模組會把最會壞的部分留在測試之外。因此測試必須跑在有真實版面尺寸的瀏覽器裡（jsdom 的 `getBoundingClientRect` 回傳全零，量不出 44px 這種東西）。

**Prior art**：這個 repo 目前**沒有任何測試**，本 spec 建立第一組。唯一的既有驗證前例是 `scripts/validate_data.py`（build-time，14 條檢查，0 errors 1 warning），它的風格值得延續——錯誤訊息要說明**為什麼**這條規則存在，而不只是說哪裡錯了。

**必須涵蓋的案例**（前五項的座標與預期結果已在原型實測過）：

1. 點大門右邊約 13px（故意點歪）→ 大門進入候選 → 第二段選到 `hs-door-entry`
2. 點客廳西北角 → 柱與窗都進候選 → 在 3×12cm 的重疊區確認 → 選到 `hs-col-nw`（柱），**不是**窗
3. 點玄關左邊的空白 → 0 候選 → 縮放維持 1.0×（**沒有放大**）→ 顯示提示
4. 點主臥衛浴（最壞情況）→ 9 個候選 → 第二段選得到其中任一個
5. `fitLocked` 為真時：使用者縮放被擋，但第一段的自動 3× 照常發生
6. `confirmed` 狀態下直接點圖上別處 → 開始新的第一段，不需要先按「重選」
7. 說明卡的關閉鍵與「其他位置」列量得出 ≥ 44×44 CSS px
8. `symbol_id` 為 `null` 的 hotspot 不出現在候選裡、不計入「共 N 處」
9. 鍵盤：Tab 的順序符合「依房間、房間內依類別」；Enter 開卡、Esc 關卡
10. 「共 N 處」的數字與 floorplan 資料一致（窗 9 處、單扇門 5 處、柱 5 處）

## Out of Scope

- **符號頁 `/symbols/[id]` 與分類瀏覽、搜尋**（M3）。含 §6.2.1 的「符號頁 → 平面圖」轉換點與自動高亮。
- **找找看小遊戲**（M4）。M2 只留 `fitLocked` 介面，不接 UI、不出題、不計分。
- **學習進度**（M4）。
- **Analytics 埋點**（M5）。
- **第 2、3 張格局範例圖**（M6）。但檢視器不得寫死 `3b2l_standard`。
- **M1 的內容查證**（9 個 convention 符號補第 2 個交叉來源）。與 M2 並行，不互相阻塞——查證未完成的符號檢視器照樣顯示，`verification_status` 不影響前台呈現。
- **sprite 與 `render_svg.py` 在衛浴廚具 4 個符號上的畫法不一致**（PRD §12）。成因已知，另開票，不混進 M2。
- **「樑」的圖上處理**。樑在 floorplan 上沒有 hotspot（§4.2），M2 的檢視器不需要為它做任何事；它的特殊處理在符號頁（M3）。

## Further Notes

- **`design/Main.dc.html` 是 v0.3 時期的稿**：它示範用的「密閉式撒水頭」在 v0.4 砍設備類符號時已經不在 14 個之內。**版面尺寸（392/660px、84px 下限、44px 命中）仍然有效且是實測出來的，照用；內容欄位要換成實際存在的符號。**
- **PRD §13 對 M2 的完成定義已修正（v0.6）**：原文「觸控目標達 44px」與 §6.1.1 衝突——37/37 熱區永遠達不到，兩段式就是替代方案，維持原文會讓驗收在字面上不可能通過。現已改為「手機實機上，圖上任一符號都能在兩段式內選到；說明卡的**控制元件**（關閉鍵、「其他位置」列）達 44px」。**這是 M2 的驗收基準，不必再回頭質疑它。**
- 原型 `prototype/two-stage-tap`（commit `4f18334`）是這些數字的 primary source，實作時遇到「這個數字哪來的」直接查它。它是單一 HTML 檔，double-click 就能重跑。
