import { hasSymbol } from "@/lib/floorplan/hotspots";
import type { Hotspot } from "@/lib/floorplan/types";

// 找找看從哪些符號出題、一局幾題（spec「可出題符號、題數與出題」）。
// 純函式：不碰 DOM、不讀 localStorage，與搜尋比對同一種定位，測試在 node context 餵手寫的小輸入。

/**
 * 可出題符號（CONTEXT.md）：這張圖上**至少有一個熱區**的符號，依第一次出現的順序，不重複。
 *
 * **只有這一種算法。** 找找看頁產不產生、一局幾題、題目池、學習進度的分母都問它——各算各的，
 * 遲早有一邊多出或少掉一個符號。它與 `isSymbolAbsent` 是同一件事的正反面：沒有熱區的符號（樑）不在裡面，
 * 不需要被點名排除。指向 null 的熱區不算任何符號（`hasSymbol`，檢視器對它們也是安靜略過）。
 */
export function quizzableSymbols(hotspots: Hotspot[]): string[] {
  return [...new Set(hotspots.filter(hasSymbol).map((h) => h.symbol_id as string))];
}

/**
 * 一局的題數：可出題數的一半，無條件進位，不設上限（PRD §6.3、CONTEXT.md「一局」）。
 * 進位是為了讓**連續打完兩局必定考遍**——13 個符號兩局各 6 題會漏一個。
 */
export const roundSize = (quizzableCount: number) => Math.ceil(quizzableCount / 2);

/**
 * 一局依序要出的 symbol id：從可出題符號裡挑 `roundSize` 個、不重複，順序隨機。
 *
 * 亂數來源由呼叫端傳入——頁面傳 `Math.random`，測試傳固定序列——所以這個函式本身是純的。
 * **目前是均勻隨機**；依熟悉度的優先序（還沒遇到 → 還不熟 → 已認識，PRD §6.3）是 M4 票 04 的事。
 */
export function pickQuestions(quizzable: string[], random: () => number): string[] {
  // Fisher–Yates：每一種排列機率相同。`sort(() => random() - 0.5)` 不是——它的偏差取決於排序演算法。
  const pool = [...quizzable];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, roundSize(quizzable.length));
}
