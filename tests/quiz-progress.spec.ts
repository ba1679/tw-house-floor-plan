import { test, expect, type Page } from "@playwright/test";
import {
  LAYOUT_ID,
  ROUND_SIZE,
  answerByTwoTaps,
  cleanHotspotsOf,
  currentTarget,
  nextOf,
  onPlan,
  otherThan,
  playToResults,
  progressOf,
  progressText,
  seedProgress,
  startRound,
  storedProgress,
} from "./quiz-play";
import { blockLocalStorage } from "./storage";

// 學習進度（M4 票 04）：每一次作答立刻寫進 localStorage，下一局依熟悉度出題。
// 斷言看的是 localStorage 裡寫了什麼、這一局出了哪幾題（spec「什麼是好的測試」），不看元件的 state。

const layoutRecord = async (page: Page) => (await storedProgress(page))?.layouts?.[LAYOUT_ID];

test.describe("學習進度的記帳", () => {
  test("答對記在題目的 correct；答錯記在題目的 wrong，被點中的那個不記；updated_at 跟著更新", async ({
    page,
  }) => {
    await seedProgress(page, {
      version: 1,
      layouts: { [LAYOUT_ID]: { correct: {}, wrong: {}, updated_at: "2000-01-01" } },
    });
    await startRound(page);

    const first = await currentTarget(page);
    await answerByTwoTaps(page, cleanHotspotsOf(first)[0]);
    await expect.poll(async () => (await layoutRecord(page))?.correct?.[first]).toBe(1);
    const afterFirst = await layoutRecord(page);
    expect(afterFirst.updated_at, "作答之後 updated_at 沒有更新").not.toBe("2000-01-01");
    expect(afterFirst.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await nextOf(page).click();

    await expect(progressOf(page)).toHaveText(progressText(2));
    const second = await currentTarget(page);
    const picked = otherThan(second);
    await answerByTwoTaps(page, cleanHotspotsOf(picked)[0]);
    await expect.poll(async () => (await layoutRecord(page))?.wrong?.[second]).toBe(1);

    // 點歪不等於不認得（CONTEXT.md「熟悉度」）：答錯只記在題目上。
    const afterSecond = await layoutRecord(page);
    expect(afterSecond.wrong[picked], `被點中的 ${picked} 被記成答錯了`).toBeUndefined();
    expect(afterSecond.correct[second]).toBeUndefined();
  });

  test("答到第 3 題時重新整理：回到開場，前 2 題的紀錄已經在 localStorage", async ({ page }) => {
    // 另一張圖的一筆紀錄：app 寫進來的時候不能把它弄掉。
    await seedProgress(page, {
      version: 1,
      layouts: { other_layout: { correct: { window: 2 }, wrong: {} } },
    });
    await startRound(page);

    const answered: string[] = [];
    for (let i = 1; i <= 2; i++) {
      const target = await currentTarget(page);
      answered.push(target);
      await answerByTwoTaps(page, cleanHotspotsOf(target)[0]);
      await nextOf(page).click();
    }
    await expect(progressOf(page)).toHaveText(progressText(3));

    await page.reload();

    await expect(page.getByRole("button", { name: "開始" })).toBeEnabled();
    await expect(progressOf(page)).toBeHidden();
    const stored = await storedProgress(page);
    expect(stored.layouts[LAYOUT_ID].correct).toEqual(
      Object.fromEntries(answered.map((id) => [id, 1])),
    );
    expect(stored.layouts.other_layout.correct).toEqual({ window: 2 });
  });

  // PRD §6.6.1：版本不符時直接丟棄重來，不寫遷移。
  test("版本不符的紀錄視為空紀錄：第一次作答後寫回 version 1，舊的次數一筆不留", async ({ page }) => {
    await seedProgress(page, {
      version: 0,
      layouts: {
        [LAYOUT_ID]: { correct: Object.fromEntries(onPlan.map((id) => [id, 5])), wrong: { window: 3 } },
      },
    });
    await startRound(page);

    const first = await currentTarget(page);
    await answerByTwoTaps(page, cleanHotspotsOf(first)[0]);

    await expect.poll(async () => (await storedProgress(page))?.version).toBe(1);
    const record = await layoutRecord(page);
    expect(record.correct).toEqual({ [first]: 1 });
    expect(record.wrong).toEqual({});
  });

  // spec user story 42：用無痕視窗的人照樣能玩，只是不會被記住。
  test("瀏覽器封鎖 localStorage：一局走得完、再玩一次也出得了題，不丟例外", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await blockLocalStorage(page);

    await startRound(page);
    await playToResults(page);
    await expect(page.getByText(`答對 ${ROUND_SIZE} / ${ROUND_SIZE} 題`)).toBeVisible();

    // 「再玩一次」會重讀進度再出題：讀不到也要出得了題。
    await page.getByRole("button", { name: "再玩一次" }).click();
    await expect(progressOf(page)).toHaveText(progressText(1));
    expect(errors).toEqual([]);
  });
});

test.describe("出題優先序", () => {
  test("6 個還沒遇到 + 3 個還不熟（錯 3、2、1）+ 4 個已認識 → 這一局是那 6 個加上錯 3 次的那一個", async ({
    page,
  }) => {
    // 切在題數上：還沒遇到的 6 個填不滿 7 題，剩下的 1 個空位給錯最多的那一個。只斷言集合，不斷言順序（spec）。
    const known = onPlan.slice(0, 4);
    const missed = onPlan.slice(4, 7);
    const unseen = onPlan.slice(7);
    expect(unseen, "主圖的可出題符號不是 13 個，這組切法要重算").toHaveLength(6);

    await seedProgress(page, {
      version: 1,
      layouts: {
        [LAYOUT_ID]: {
          correct: Object.fromEntries(known.map((id) => [id, 1])),
          // 第一個已認識的也錯過 4 次：答對過一次就是已認識，不因為錯得比還不熟的多就被排進來。
          wrong: { [missed[0]]: 3, [missed[1]]: 2, [missed[2]]: 1, [known[0]]: 4 },
        },
      },
    });
    await startRound(page);

    const asked = await playToResults(page);
    expect([...asked].sort()).toEqual([...unseen, missed[0]].sort());
  });

  // 票面那一句：「打完兩局，13 個每一個都考過了」。第二局靠的是第一局寫進去的紀錄，所以這條把記帳與出題串在一起走一次。
  test("空白的紀錄連打兩局：第二局先考第一局沒考過的，兩局考遍每一個符號", async ({ page }) => {
    await startRound(page);
    const first = await playToResults(page);

    await page.getByRole("button", { name: "再玩一次" }).click();
    const second = await playToResults(page);

    expect(new Set([...first, ...second]).size, `兩局出的題：${first} / ${second}`).toBe(onPlan.length);
  });
});
