# 03: 說明卡展開／收合與結構性動效

**What to build:** 說明卡打開、關閉、展開與收合時，卡片和平面圖同步改變高度；長內容展開後，同一個控制變成「收合看平面圖」，讓使用者回到圖而不關掉目前符號。

**Blocked by:** None (can start immediately)

**Status:** resolved

規格：`../spec.md` 的「UX Decisions 2–3」「Accessibility and Responsive Decisions」；`DESIGN.md`「動效」。

## 注意

- ADR-0003 不變：卡片仍是 layout row，不是 overlay。
- overflow 且收合時顯示「展開完整內容」；展開後**同一個 button**改為「收合看平面圖」。
- 使用 `aria-expanded` 與 `aria-controls`。切換後焦點留在同一顆控制，不得因 conditional render 掉到 body。
- 收合只改高度並把 body scroll 回頂端；selected hotspot、occurrence、InfoSheet 都保留。
- × 與 Esc 仍關整張卡；收合不是 close。
- 動效只處理卡片的結構性轉移與既有房間 dim；熱區 state、答題回饋不動。
- `prefers-reduced-motion: reduce` 時 duration 為 0／無 transition，不做慢速替代。
- 這張先提供 action callback seam；analytics payload 在票 05 接上。

## Acceptance criteria

- [x] overflow 卡片可以「展開完整內容」，展開後同一控制變成「收合看平面圖」
- [x] 收合後 body 回頂端，卡片仍開著、同一 symbol／occurrence 仍 selected，平面圖恢復可操作空間
- [x] 鍵盤焦點在 expand → collapse → expand 間不丟失；`aria-expanded` 與可見狀態一致
- [x] ×、Esc、自由看圖與找找看原本不同的 close semantics 全部不變
- [x] 一般 motion 下卡片與平面圖同步轉移，沒有先跳一次再滑一次；卡片沒有變 overlay
- [x] reduced motion 下四種轉移直接到最終狀態
- [x] 375×812、320×568 上展開後收合控制始終可達；收合後圖框高度恢復
- [x] 既有 InfoSheet、pan/zoom、quiz feedback、keyboard 測試維持綠

## Comments

- The one persistent expand control now changes between 「展開完整內容」 and
  「收合看平面圖」, keeps keyboard focus, resets body scroll on collapse, and
  transitions alongside the resized viewport. Reduced motion resolves directly.
