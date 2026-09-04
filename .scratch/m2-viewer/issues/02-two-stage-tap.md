# 02: 兩段式點擊選到符號

**What to build:** 使用者點圖上的大略位置——不需要點準——圖放大到 3× 並圈出附近的候選符號；再點一次確認要看哪一個。選到之後畫面回到原本的視野，被選中的符號維持標示。這是全站的基礎操作，不是找找看專用。

這張票要解的是：37 個熱區沒有一個滿足 44×44px（最大的短邊只有 34.5px），而把命中區放大到 44px 在數學上走不通——柱與相鄰窗的間距只有 3cm，命中區會互相吃掉。

**Blocked by:** 01（專案骨架與靜態平面圖）

**Status:** done

互動邏輯是一個純模組 `(state, action) => state`，不碰 DOM。以下來自原型 `prototype/two-stage-tap`（commit `4f18334`），是它編碼的決策：

```ts
const TAP1_TOLERANCE_PX = 46;  // 第一段容錯半徑
const TAP2_TOLERANCE_PX = 30;  // 第二段「最近者」上限
const STAGE_ZOOM        = 3;   // 第一段之後的自動放大倍率

// 熱區命中優先序：面積小者優先。兩段都適用。
const bySmallestArea = (a, b) => areaCm2(a) - areaCm2(b);

// 單位規則：容錯半徑一律以 CSS px 定義，判定時依當前 scale 換算回圖面 cm
const pxToCm = (s, px) => px / scalePxPerCm(s);

function firstTap(s, x, y) {
  const tolCm = pxToCm(s, TAP1_TOLERANCE_PX);
  const cands = s.hotspots.filter(h => distCm(h,x,y) <= tolCm).sort(bySmallestArea);
  if (cands.length === 0) return { ...s, stage:'browsing' };  // 提示換位置，不放大
  return { ...s, stage:'candidates', candidates: cands,
           tolCmAtTap: tolCm,           // ← 存起來給繪製用
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

- [x] 三個狀態可運作：`browsing` → `candidates` → `confirmed`
- [x] 第一段容錯 46 CSS px，第二段 30 CSS px，自動放大 3×——三個數字不改（PRD §11 #21）
- [x] **座標換算以 CSS transform 為基礎**，不是每幀重設 SVG viewBox（PRD §9 效能要求）。原型用 viewBox 只為求簡單，這一層要重寫
- [x] 容錯半徑以 CSS px 存，判定時依當前縮放換算回圖面 cm
- [x] 繪製第一段容錯範圍時用命中判定當下存下的 `tolCmAtTap`，**不在放大後重算**（重算後只剩實際的三分之一，圈外的熱區也會亮著）
- [x] 面積小者優先：點客廳西北角的重疊區，選到柱（`hs-col-nw`）而不是窗
- [x] 點到 46px 內無任何熱區之處：顯示提示，**縮放維持不變、不放大**
- [x] `confirmed` 狀態下再點圖上別處，直接開始新的第一段，不必先按「重選」（PRD §11 #20）
- [x] 第二段的命中**只掃第一段圈出的候選集**，不掃全部熱區（PRD §11 #19）
- [x] 「重選」可隨時退回第一段並還原視野
- [x] `symbol_id` 為 `null` 的 hotspot 安靜略過：不畫、不進候選
- [x] 狀態機接受 `fitLocked` 輸入：它擋使用者發起的縮放，**不擋 `firstTap` 的自動放大**（M2 不接 UI，介面留給 M4）
- [x] 選到符號後顯示其名稱（最小可驗證即可，完整說明卡是 03）
- [x] 測試涵蓋：點大門右邊約 13px 仍選得到大門；重疊區柱贏窗；空白處不放大；主臥衛浴 9 個候選仍選得到任一個；`confirmed` 後可直接續點

## Comments

**2026-09-04 — 實作完成。22 個測試通過（票 01 留下 12 個，這張加 10 個）。**

模組落在 PRD §10.1 的分層上：

- `lib/viewer/view.ts` —— 換算層。原型用每幀重設 viewBox，這裡照 spec 要求整層重寫成 CSS transform。
  `Projection`（viewBox + 可視區寬度 + 視野）綁成一個值傳，因為三者拆開走就多一個
  「拿舊視野配新寬度」的機會，而那種錯在畫面上看不出來。`ViewerState` 結構上就是一個
  `Projection`，所以不需要轉接。
- `lib/viewer/interaction.ts` —— 純狀態機，不碰 DOM。46 / 30 / 3× 照搬原型。
- `components/FloorPlanViewer.tsx` —— 熱區層 + 接線。`FloorPlanView` 收斂成純 SVG Renderer
  並接受 children，票 07 換掉它時介面不動。

**挖到一個矛盾，順手修掉。** floorplan schema 明寫 `symbol_id` 可以是 null——「viewer 應略過」——
但 `validate_data.py` 的 `h["symbol_id"] not in symbol_ids` 把 None 判成斷掉的參照，**build 直接失敗**。
也就是說本票「null 安靜略過」那條在今天的管線裡根本走不到，而 M1 查證未完成的圖也上不了線，
正好是 null 要避免的事。已改成只擋非 null 的斷參照，並補一條測試。

**與原型／spec 不同的地方，都是刻意的：**

- **確認後清掉候選高亮。** 原型的 render 保留另外 8 個藍框，但原型是有側欄的除錯外殼，
  那不是產品決定。圖本身就是學習對象，選完還亮著 8 個框是雜訊。
- **「空白處不放大」那條測試改點房子外面的留白**，不是 spec 寫的「玄關左邊」。
  原型在 375px 全出血下量，容錯 = 圖面 147cm；現在頁面左右各留 16px，圖只有 343px，
  容錯變成 161cm，**房子裡已經沒有一個點是空的**（最寬的客廳也只剩 159cm 淨空）。
  這件事值得記著：圖要不要全出血是票 03 排版時要決定的，決定了會改變這個數字。

**留給後面的票，不是漏掉：**

- **`fitLocked` 只接輸入、沒有 guard。** M2 沒有任何「使用者發起的縮放」動作可以擋，
  寫一個沒有呼叫者的 guard 就是憑空想像。票 04 的檢查清單本來就列了那條測試，交給它。
- **從 `confirmed` 按「重選」的視野**：原本會跳回全圖（`savedView` 在確認時已清空），已修成留在當下視野。
  今天看不出差別——全圖以外的視野要等票 04 的 pan/zoom 才存在。
- **`symbol_id` 為 null 的熱區在頁面上被略過，沒有頁面層的測試。** 資料裡 37 個熱區沒有一個是 null，
  而頁面是 SSG 產物、測試改不了它的資料。擋 build 的那一側已經有測試（改資料 → 跑驗證）。
  票 03 的「共 N 處」要用同一條過濾，屆時一併處理。
- **「點圖上任何一個位置」那句引導拿掉了。** 那是票 05 的文案，而且它要配 localStorage 只出現一次；
  放在這裡會變成每次都出現，牴觸 user story 23。

**code review 後的修正：**

- `data-state` 的 `idle` 改成 `normal`，並把 `candidate` / `selected` 補進 `CONTEXT.md` 的 State 詞條。
  原本的四個值是兩段式升為全站基礎操作之前寫的，沒有詞可以區分「候選」與「已確認」，
  用 `highlighted` 概括會把 M3 的自動高亮也吃掉。同時新增 `Stage`（互動階段）與 `View`（視野）兩條。
- `lib/floorplan/data.ts` 那句「整個檢視器唯一碰檔案系統的地方」已經不成立（`lib/symbols/data.ts` 也讀檔），
  改成只講圖面資料。symbol 是內容、與任何一張圖無關，本來就該有自己的載入器。
- 產生器路徑現在有兩份（Python 一份、TS 測試一份），兩邊互相註記，清單補進 `docs/adr/0002` 的後果。
- `reduce` 改名 `reduceViewer`（在 import 處會被讀成 `Array.reduce`）；
  只有模組內用得到的常數與函式收回去不 export。測試刻意寫死 46 / 30 而不 import 常數——
  import 了就變成拿程式碼驗證程式碼。
- **第二段落空原本沒有任何回饋**：畫面上的字跟成功時一模一樣。已加 `confirmMissed`，
  spec 寫的是「留在第二段，提示再試或重選」。
