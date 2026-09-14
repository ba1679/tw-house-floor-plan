import { test, expect } from "@playwright/test";
import { pickQuestions, quizzableSymbols, roundSize } from "@/lib/quiz/questions";
import type { LayoutProgress } from "@/lib/quiz/progress";
import type { Hotspot } from "@/lib/floorplan/types";

// 一局出幾題、出哪幾題——spec「Testing Decisions」的 seam ③，跑在 node context，不需要 `page` fixture。
//
// 真資料只有一種形狀（13 個可出題符號），而會出錯的正是它做不出來的形狀：可出題數為偶數、為 1、為 0，
// 某一層的數量少於剩下的空位。這些在瀏覽器裡要測就得改資料重跑 build，所以餵**手寫的小輸入**，不讀真資料。

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

/** 固定的亂數序列：依序吐出這幾個數字，吐完從頭再來（spec：測試傳固定序列）。 */
const cycle = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

/**
 * 幾組彼此不同的序列。優先序的斷言要對每一組都成立：
 * 只拿一組測，「剛好這組亂數湊出了對的集合」與「優先序是對的」分不開。
 */
const SEQUENCES = [[0], [0.999], [0.5, 0.1, 0.9], [0.3, 0.7, 0.05, 0.62, 0.41]];

/** 手寫一份紀錄。`correct`、`wrong` 是 symbol id → 次數，沒列到的就是還沒遇到。 */
const progress = (
  correct: Record<string, number> = {},
  wrong: Record<string, number> = {},
): LayoutProgress => ({ correct, wrong });

const sorted = (ids: string[]) => [...ids].sort();

test.describe("一局出哪些題", () => {
  test("還沒遇到的先出，還不熟的其次，已認識的最後", () => {
    // 6 個可出題 → 一局 3 題。2 個還沒遇到填不滿，第 3 個空位給還不熟的，已認識的一個都輪不到。
    // k1 答對過、也答錯過 4 次：它是已認識（答對過一次就算），不因為錯得多就排進還不熟的前面。
    const quizzable = ["k1", "k2", "u1", "m1", "k3", "u2"];
    const record = progress({ k1: 1, k2: 2, k3: 1 }, { m1: 1, k1: 4 });

    for (const values of SEQUENCES) {
      const picked = pickQuestions(quizzable, record, cycle(values));
      expect(sorted(picked), `亂數序列 ${values}`).toEqual(["m1", "u1", "u2"]);
    }
  });

  test("還不熟的依錯誤次數由多到少", () => {
    // 5 個都還不熟 → 一局 3 題：錯 5、5、3 的三個。錯 2 與錯 1 的留到之後。
    const quizzable = ["m1", "m2", "m3", "m4", "m5"];
    const record = progress({}, { m1: 1, m2: 3, m3: 2, m4: 5, m5: 5 });

    for (const values of SEQUENCES) {
      const picked = pickQuestions(quizzable, record, cycle(values));
      expect(sorted(picked), `亂數序列 ${values}`).toEqual(["m2", "m4", "m5"]);
    }
  });

  test("某一層不夠時，由下一層補滿題數；輸出沒有重複", () => {
    // 6 個可出題 → 一局 3 題：還沒遇到的只有 1 個，沒有還不熟的，另外 2 題由已認識補。
    const quizzable = ["u1", "k1", "k2", "k3", "k4", "k5"];
    const record = progress({ k1: 1, k2: 1, k3: 1, k4: 1, k5: 1 });

    for (const values of SEQUENCES) {
      const picked = pickQuestions(quizzable, record, cycle(values));
      expect(picked, `亂數序列 ${values}`).toHaveLength(3);
      expect(picked).toContain("u1");
      expect(new Set(picked).size, `出了重複的題目：${picked}`).toBe(picked.length);
      for (const id of picked) expect(quizzable).toContain(id);
    }
  });

  // PRD §6.6：全部認得之後照樣可玩，出題就在已認識的層裡隨機。
  test("每一個都認得了照樣出題：一局題數不變、不重複", () => {
    const quizzable = Array.from({ length: 13 }, (_, i) => `k${i}`);
    const record = progress(Object.fromEntries(quizzable.map((id) => [id, 1])));

    for (const values of SEQUENCES) {
      const picked = pickQuestions(quizzable, record, cycle(values));
      expect(picked).toHaveLength(7);
      expect(new Set(picked).size).toBe(7);
    }
  });

  // spec「熟悉度只由次數算」：紀錄裡有、但已經不是可出題符號的 id（例如日後資料改了）一律忽略。
  test("紀錄裡不是可出題符號的 id 不會出成題目，也不佔還不熟那一層的位子", () => {
    const quizzable = ["a", "b", "c", "d"];
    const record = progress({ gone: 3 }, { beam: 9, removed: 4, c: 1 });

    for (const values of SEQUENCES) {
      const picked = pickQuestions(quizzable, record, cycle(values));
      expect(picked, `亂數序列 ${values}`).toHaveLength(2);
      for (const id of picked) expect(quizzable).toContain(id);
      // a、b、d 還沒遇到，c 還不熟：一局 2 題全由還沒遇到的出。
      expect(picked).not.toContain("c");
    }
  });

  test("同一組亂數序列，出的題與出題順序都一樣", () => {
    const quizzable = ["u1", "u2", "m1", "m2", "k1", "k2", "k3"];
    const record = progress({ k1: 1, k2: 1, k3: 1 }, { m1: 2, m2: 1 });

    for (const values of SEQUENCES) {
      expect(pickQuestions(quizzable, record, cycle(values))).toEqual(
        pickQuestions(quizzable, record, cycle(values)),
      );
    }
  });

  test("換一組亂數序列，換的是同一層裡挑哪幾個，不換層的優先", () => {
    // 1 個還沒遇到加 5 個已認識 → 一局 3 題：u1 每一次都在，另外 2 題是哪兩個已認識的由亂數決定。
    const quizzable = ["u1", "k1", "k2", "k3", "k4", "k5"];
    const record = progress({ k1: 1, k2: 1, k3: 1, k4: 1, k5: 1 });

    const one = pickQuestions(quizzable, record, cycle([0]));
    const other = pickQuestions(quizzable, record, cycle([0.999]));
    expect(one).toContain("u1");
    expect(other).toContain("u1");
    expect(sorted(one), "兩組亂數挑出了同一組已認識的——同層裡沒有在隨機").not.toEqual(sorted(other));
  });
});
