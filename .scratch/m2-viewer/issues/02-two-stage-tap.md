# 02: 兩段式點擊選到符號

**What to build:** 使用者點圖上的大略位置——不需要點準——圖放大到 3× 並圈出附近的候選符號；再點一次確認要看哪一個。選到之後畫面回到原本的視野，被選中的符號維持標示。這是全站的基礎操作，不是找找看專用。

這張票要解的是：37 個熱區沒有一個滿足 44×44px（最大的短邊只有 34.5px），而把命中區放大到 44px 在數學上走不通——柱與相鄰窗的間距只有 3cm，命中區會互相吃掉。

**Blocked by:** 01（專案骨架與靜態平面圖）

**Status:** ready-for-agent

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

- [ ] 三個狀態可運作：`browsing` → `candidates` → `confirmed`
- [ ] 第一段容錯 46 CSS px，第二段 30 CSS px，自動放大 3×——三個數字不改（PRD §11 #21）
- [ ] **座標換算以 CSS transform 為基礎**，不是每幀重設 SVG viewBox（PRD §9 效能要求）。原型用 viewBox 只為求簡單，這一層要重寫
- [ ] 容錯半徑以 CSS px 存，判定時依當前縮放換算回圖面 cm
- [ ] 繪製第一段容錯範圍時用命中判定當下存下的 `tolCmAtTap`，**不在放大後重算**（重算後只剩實際的三分之一，圈外的熱區也會亮著）
- [ ] 面積小者優先：點客廳西北角的重疊區，選到柱（`hs-col-nw`）而不是窗
- [ ] 點到 46px 內無任何熱區之處：顯示提示，**縮放維持不變、不放大**
- [ ] `confirmed` 狀態下再點圖上別處，直接開始新的第一段，不必先按「重選」（PRD §11 #20）
- [ ] 第二段的命中**只掃第一段圈出的候選集**，不掃全部熱區（PRD §11 #19）
- [ ] 「重選」可隨時退回第一段並還原視野
- [ ] `symbol_id` 為 `null` 的 hotspot 安靜略過：不畫、不進候選
- [ ] 狀態機接受 `fitLocked` 輸入：它擋使用者發起的縮放，**不擋 `firstTap` 的自動放大**（M2 不接 UI，介面留給 M4）
- [ ] 選到符號後顯示其名稱（最小可驗證即可，完整說明卡是 03）
- [ ] 測試涵蓋：點大門右邊約 13px 仍選得到大門；重疊區柱贏窗；空白處不放大；主臥衛浴 9 個候選仍選得到任一個；`confirmed` 後可直接續點
