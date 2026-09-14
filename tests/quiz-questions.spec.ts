import { test, expect } from "@playwright/test";
import { quizzableSymbols, roundSize } from "@/lib/quiz/questions";
import type { Hotspot } from "@/lib/floorplan/types";

// 一局出幾題、題目從哪些符號裡出——spec「Testing Decisions」的 seam ③，跑在 node context，不需要 `page` fixture。
//
// 真資料只有一種形狀（13 個可出題符號），而會出錯的正是它做不出來的形狀：可出題數為偶數、為 1、為 0。
// 這些在瀏覽器裡要測就得改資料重跑 build，所以餵**手寫的小輸入**，不讀真資料。

/** 一個熱區。座標與這裡問的事無關，全部給同一塊。 */
const hs = (id: string, symbol_id: string | null): Hotspot => ({
  id,
  symbol_id,
  shape: "rect",
  coords: [0, 0, 10, 10],
});

test.describe("可出題符號與題數", () => {
  // CONTEXT.md「一局」：題數是可出題數的一半、無條件進位，所以連續打完兩局必定考遍。
  // 期望值是 spec 案例 25 寫下的字面值，不是拿同一條公式算出來的。
  test("題數是可出題數的一半、無條件進位：13 → 7、12 → 6、1 → 1、0 → 0", () => {
    expect(roundSize(13)).toBe(7);
    expect(roundSize(12)).toBe(6);
    expect(roundSize(1)).toBe(1);
    expect(roundSize(0)).toBe(0);
  });

  // CONTEXT.md「可出題符號」：在這張 floorplan 上至少有一個熱區的符號。
  // 一個符號畫了幾處都只出一題；指向 null 的熱區（還沒決定是哪個符號，PRD §7.3）不算任何符號。
  test("一張圖上有熱區的每個符號各算一次；指向 null 的熱區不算", () => {
    const hotspots = [
      hs("hs-win-a", "window"),
      hs("hs-col-a", "column"),
      hs("hs-win-b", "window"),
      hs("hs-unknown", null),
      hs("hs-win-c", "window"),
    ];

    expect([...quizzableSymbols(hotspots)].sort()).toEqual(["column", "window"]);
  });

  // 樑在建案平面圖上一處都沒有（PRD §4.2）：它不出題，但它不需要被點名排除——沒有熱區就不在裡面。
  test("一個熱區都沒有的圖，沒有可出題符號，一局 0 題", () => {
    expect(quizzableSymbols([])).toEqual([]);
    expect(roundSize(quizzableSymbols([]).length)).toBe(0);
  });
});
