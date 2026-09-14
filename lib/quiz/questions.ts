import { hasSymbol } from "@/lib/floorplan/hotspots";
import type { Hotspot } from "@/lib/floorplan/types";
import { groupByFamiliarity, type LayoutProgress } from "./progress";

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
 * 這張圖有沒有找找看：至少一個可出題符號。
 *
 * 找找看頁產不產生（M4 票 01）、平面圖頁與首頁要不要放入口（票 06），問的都是這一句。
 * 各寫一次的話，會有「入口放了、頁面卻 404」或「頁面產生了、卻沒有入口」的那一天。
 */
export const hasQuiz = (hotspots: Hotspot[]) => quizzableSymbols(hotspots).length > 0;

/**
 * 一局的題數：可出題數的一半，無條件進位，不設上限（PRD §6.3、CONTEXT.md「一局」）。
 * 進位是為了讓**連續打完兩局必定考遍**——13 個符號兩局各 6 題會漏一個。
 */
export const roundSize = (quizzableCount: number) => Math.ceil(quizzableCount / 2);

/** Fisher–Yates：每一種排列機率相同。`sort(() => random() - 0.5)` 不是——它的偏差取決於排序演算法。 */
function shuffle<T>(items: T[], random: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * 一局依序要出的 symbol id（spec「可出題符號、題數與出題」，PRD §6.3）：
 *
 * 1. 依熟悉度分三層：**還沒遇到** → **還不熟**（錯最多的在前，同數隨機）→ **已認識**（隨機）
 * 2. 依層序填到 `roundSize` 題為止
 * 3. 選出來的那幾題**整局打亂**再出。不打亂的話題序就洩漏了熟悉度：前幾題一定是沒遇過的，最後幾題一定是他會的
 *
 * 所以第二局必定先考第一局沒考過的，打完兩局考遍每一個；之後每一局先考還不熟的。
 *
 * 只走 `quizzable`、從不走紀錄：紀錄裡有、但已經不是可出題符號的 id（日後資料改了）自然不會被挑到。
 * 亂數來源由呼叫端傳入——頁面傳 `Math.random`，測試傳固定序列——所以這個函式本身是純的。
 */
export function pickQuestions(
  quizzable: string[],
  progress: LayoutProgress,
  random: () => number,
): string[] {
  // 分組與還不熟的排法是 `groupByFamiliarity` 的，開場的清單問的是同一個。這裡只決定同一組裡隨機：
  // 每一組先打亂，還不熟再依錯誤次數排——sort 是穩定的，同數的幾個因此維持打亂後的先後，也就是同數隨機。
  const { unseen, missed, known } = groupByFamiliarity(quizzable, progress, (ids) => shuffle(ids, random));

  return shuffle([...unseen, ...missed, ...known].slice(0, roundSize(quizzable.length)), random);
}
