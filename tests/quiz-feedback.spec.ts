import { test, expect, type Page } from "@playwright/test";
import {
  PLAN,
  answerByTwoTaps,
  cleanHotspotsOf,
  currentTarget,
  hotspotsOf,
  nextOf,
  planOf,
  progressOf,
  progressText,
  startRoundAt,
  statusOf,
  symbolOf,
} from "./quiz-play";
import { dragLeft, markingOf, painted, pinch } from "./viewer-page";

// 作答之後、按「下一題」之前（M4 票 02）：答案標在圖上、答錯當場學、圖暫停到「下一題」。
//
// 每一條都用 `startRoundAt` 決定題目（出題優先序，票 04），所以知道題目是誰、該點哪裡才是答對或答錯。
// 斷言看熱區的 State、卡片上的字、焦點落在哪——使用者感知得到的東西。

const sheetOf = (page: Page) => page.locator("#info-sheet");
/** 卡片最上面那一段：「你點的是 X」，視情況接差異句。 */
const pickedNoteOf = (page: Page) => page.locator('#info-sheet [data-section="note"]');
const showSheetOf = (page: Page) => page.getByRole("button", { name: "看說明" });

/** 圖上每一個熱區此刻的 State，依 DOM 順序。 */
const statesOf = (page: Page) =>
  page
    .locator("#hotspot-layer rect")
    .evaluateAll((els) => els.map((el) => `${el.id}=${el.getAttribute("data-state")}`));

/** 此刻是這個 State 的熱區 id，排好序。 */
const idsInState = (page: Page, state: string) =>
  page
    .locator(`#hotspot-layer rect[data-state="${state}"]`)
    .evaluateAll((els) => els.map((el) => el.id).sort());

const sorted = (ids: string[]) => [...ids].sort();

async function tapCenter(page: Page, hotspotId: string) {
  const box = (await page.locator(`#${hotspotId}`).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe("答對", () => {
  test("點中的那一處是 selected，同一個符號的其餘各處是 revealed；說明卡不自動打開", async ({ page }) => {
    await startRoundAt(page, "window");
    const [clicked] = cleanHotspotsOf("window");

    await answerByTwoTaps(page, clicked);

    await expect(statusOf(page)).toHaveText("答對了。");
    expect(await idsInState(page, "selected")).toEqual([clicked]);
    // 主圖的窗 9 處畫了三種：他剛剛認得的只是其中一種，另外 8 扇也標出來。
    expect(await idsInState(page, "revealed")).toEqual(
      sorted(hotspotsOf("window").filter((id) => id !== clicked)),
    );
    // 已經會的東西不強迫再讀一次（spec user story 21）。
    await expect(sheetOf(page)).toBeHidden();

    // 檢視器此刻是閒著的 browsing，但圖點不動：其餘熱區不該亮起「這裡可以點」的提示（docs/adr/0007「後果」）。
    const other = await markingOf(page, "#hs-door-entry");
    expect(painted(other.fill), "暫停中的圖上，其餘熱區還亮著可點的底色").toBe(false);
    expect(painted(other.stroke), "暫停中的圖上，其餘熱區還亮著可點的細邊").toBe(false);
  });

  test("按「看說明」：打開題目符號的說明卡，沒有「你點的是」；出現次數只有「共 N 處」", async ({ page }) => {
    await startRoundAt(page, "window");
    await answerByTwoTaps(page, cleanHotspotsOf("window")[0]);

    await showSheetOf(page).click();

    const sheet = sheetOf(page);
    await expect(sheet.getByRole("heading", { name: "窗" })).toBeVisible();
    await expect(sheet).not.toContainText("你點的是");
    // 每一處都已經標在圖上（spec「作答之後」）：只說共幾處，不說現在是第幾處，也沒有換看下一處的那一鍵。
    await expect(sheet).toContainText("這張圖上共 9 處");
    await expect(sheet).not.toContainText("目前第");
    await expect(page.getByRole("button", { name: /其他位置/ })).toHaveCount(0);
  });
});

test.describe("答錯", () => {
  test("題目是窗、點到柱：窗的每一處 revealed、柱 selected；窗的說明卡自動打開，最上面只有「你點的是柱」", async ({
    page,
  }) => {
    await startRoundAt(page, "window");
    const [column] = cleanHotspotsOf("column");

    await answerByTwoTaps(page, column);

    await expect(statusOf(page)).toHaveText("答錯了。");
    // 他分得出自己是點歪還是認錯：答案的每一處都標出來，點到的那一個也留著。
    expect(await idsInState(page, "revealed")).toEqual(sorted(hotspotsOf("window")));
    expect(await idsInState(page, "selected")).toEqual([column]);

    const sheet = sheetOf(page);
    await expect(sheet.getByRole("heading", { name: "窗" })).toBeVisible();
    // 柱不在窗的 confused_with 裡：位置相鄰不是畫法相似（PRD §6.3.3），所以只有那一句、沒有差異句。
    await expect(pickedNoteOf(page)).toHaveText("你點的是柱。");
    // 與自由看圖同一個理由：這張卡的每一處已經都標在圖上了。
    await expect(sheet).toContainText("這張圖上共 9 處");
    await expect(sheet).not.toContainText("目前第");
  });

  test("點到的正是題目容易搞混的那一個（題目是柱、點到牆）：接上柱那一側的差異句原文", async ({ page }) => {
    await startRoundAt(page, "column");

    await answerByTwoTaps(page, cleanHotspotsOf("wall")[0]);

    const columnSide = symbolOf("column").confused_with.find((c) => c.symbol_id === "wall")!.difference;
    const wallSide = symbolOf("wall").confused_with.find((c) => c.symbol_id === "column")!.difference;
    await expect(pickedNoteOf(page)).toContainText("你點的是牆");
    await expect(pickedNoteOf(page)).toContainText(columnSide);
    // 取的是題目那一側：牆那一側寫的是另一句，從「牆」的角度說。
    await expect(pickedNoteOf(page)).not.toContainText(wallSide);
  });

  // 自由看圖只亮被點中的那一間（M2 票 07）；照那條規則，答錯時題目符號所在的房間反而會被壓暗。
  test("說明卡開著時，有 revealed 或 selected 熱區的房間都亮著，其餘的暗下去", async ({ page }) => {
    await startRoundAt(page, "window");
    await answerByTwoTaps(page, cleanHotspotsOf("column")[0]);
    await expect(sheetOf(page)).toBeVisible();

    // 房間歸屬問頁面自己（`data-room`），不在測試裡再算一次（同 keyboard.spec.ts）。
    const rooms = await page.evaluate(() => {
      const marked = document.querySelectorAll(
        '#hotspot-layer rect[data-state="revealed"], #hotspot-layer rect[data-state="selected"]',
      );
      const lit = [...new Set([...marked].map((el) => el.closest("[data-room]")!.getAttribute("data-room")!))];
      const muted = [...document.querySelectorAll('#rooms rect[data-state="muted"]')].map((el) => el.id);
      return { lit, muted };
    });

    expect(rooms.lit.length, "窗應該散在不只一間房裡").toBeGreaterThan(1);
    for (const id of rooms.lit) expect(rooms.muted, `${id} 裡有標記，卻被壓暗了`).not.toContain(id);
    expect(rooms.muted.length, "說明卡開著時，沒有任何房間暗下去").toBeGreaterThan(0);
  });
});

test.describe("作答之後、按「下一題」之前", () => {
  test("圖暫停：點圖、雙擊、雙指、拖曳、Enter、空白鍵都不改變任何熱區；關掉說明卡之後標記還在、仍在暫停", async ({
    page,
  }) => {
    await startRoundAt(page, "window");
    await answerByTwoTaps(page, cleanHotspotsOf("column")[0]);
    await expect(sheetOf(page)).toBeVisible();
    const answered = await statesOf(page);

    // 大門不是窗也不是柱：沒有暫停的話，點它會圈出候選、Enter 會選定它。
    const door = "hs-door-entry";
    await tapCenter(page, door);
    expect(await statesOf(page), "點圖").toEqual(answered);

    const box = (await page.locator(`#${door}`).boundingBox())!;
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    expect(await statesOf(page), "雙擊").toEqual(answered);

    const plan = (await planOf(page).boundingBox())!;
    const center = { x: plan.x + plan.width / 2, y: plan.y + plan.height / 2 };
    await pinch(page, center, 100, 300);
    expect(await statesOf(page), "雙指").toEqual(answered);
    await dragLeft(page, center, 80);
    expect(await statesOf(page), "拖曳").toEqual(answered);

    await page.locator(`#${door}`).focus();
    await page.keyboard.press("Enter");
    expect(await statesOf(page), "Enter").toEqual(answered);
    await page.keyboard.press(" ");
    expect(await statesOf(page), "空白鍵").toEqual(answered);

    // 自由看圖時關卡片＝回到 browsing；找找看不是（spec）。卡片收起讓框變高（RESIZE），標記也不受影響。
    const withSheet = (await planOf(page).boundingBox())!;
    await sheetOf(page).getByRole("button", { name: "關閉說明" }).click();
    await expect(sheetOf(page)).toBeHidden();
    await expect.poll(async () => (await planOf(page).boundingBox())!.height).toBeGreaterThan(withSheet.height);
    expect(await statesOf(page), "關閉說明卡").toEqual(answered);

    await tapCenter(page, door);
    expect(await statesOf(page), "關掉卡片之後點圖").toEqual(answered);
    await expect(nextOf(page)).toBeVisible();
  });

  test("「下一題」：說明卡展開著也一起收起，標記清掉、題號前進、視野回到全圖、不再暫停", async ({ page }) => {
    // 雨遮是唯一有注意事項的符號，卡片塞不下，「上拉看完整內容」才會出現。
    const index = await startRoundAt(page, "canopy_rain", { notLast: true });
    const fit = (await planOf(page).boundingBox())!;

    await answerByTwoTaps(page, cleanHotspotsOf("window")[0]);
    const expand = page.getByRole("button", { name: /上拉看完整內容/ });
    await expand.click();
    await expect(expand).toBeHidden();

    await nextOf(page).click();

    // 帶著展開的卡進下一題，就是 M2 票 08 修過的情境，而鎖定視野時連補救的平移都沒有（spec）。
    await expect(sheetOf(page)).toBeHidden();
    await expect(progressOf(page)).toHaveText(progressText(index + 1));
    expect(await idsInState(page, "selected")).toEqual([]);
    expect(await idsInState(page, "revealed")).toEqual([]);
    await expect.poll(async () => Math.round((await planOf(page).boundingBox())!.height)).toBe(Math.round(fit.height));
    const restored = (await planOf(page).boundingBox())!;
    expect(restored.width).toBeCloseTo(fit.width, 0);
    expect(restored.x).toBeCloseTo(fit.x, 0);
    expect(restored.y).toBeCloseTo(fit.y, 0);

    // 不再暫停：點一下就圈得出候選。
    await tapCenter(page, "hs-door-entry");
    await expect(page.locator("#hs-door-entry")).toHaveAttribute("data-state", "candidate");
  });

  // ADR-0007 的「後果」之一：作答後鍵盤焦點要有去處，否則「下一題」排在所有熱區之後，要 Tab 很多下才到（票 01 的 Comments）。
  test("鍵盤：答錯時焦點進說明卡，Esc 關卡之後落在「下一題」；按下去焦點回到新的題目；答對時直接落在「下一題」", async ({
    page,
  }) => {
    await startRoundAt(page, "window", { notLast: true });

    await page.locator(`#${cleanHotspotsOf("column")[0]}`).focus();
    await page.keyboard.press("Enter");
    await expect(sheetOf(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(sheetOf(page)).toBeHidden();
    await expect(nextOf(page)).toBeFocused();

    await page.keyboard.press("Enter");
    // 焦點落在題目那一列：讀螢幕的人接著聽到的是新的題目，再按 Tab 就走進圖裡。
    await expect(page.locator("#quiz-question")).toBeFocused();

    await page.locator(`#${cleanHotspotsOf(await currentTarget(page))[0]}`).focus();
    await page.keyboard.press("Enter");
    await expect(statusOf(page)).toHaveText("答對了。");
    await expect(nextOf(page)).toBeFocused();
  });
});

// 四者形狀可能相同（一個符號的每一處），意思不同：從符號頁帶著高亮進平面圖的人，不該以為自己在答題（spec Further Notes）。
// 四者不會同時出現在同一張圖上，所以各自在會出現的地方量。
test("revealed、highlighted、candidate、selected 四種 State 畫出來彼此都不同", async ({ page }) => {
  await page.goto(`${PLAN}?symbol=window`);
  await expect(page.locator("#hs-win-living")).toHaveAttribute("data-state", "highlighted");
  const highlighted = await markingOf(page, "#hs-win-living");

  await page.goto(PLAN);
  const door = page.locator("#hs-door-entry");
  await tapCenter(page, "hs-door-entry");
  await expect(door).toHaveAttribute("data-state", "candidate");
  const candidate = await markingOf(page, "#hs-door-entry");
  await tapCenter(page, "hs-door-entry");
  await expect(door).toHaveAttribute("data-state", "selected");
  const selected = await markingOf(page, "#hs-door-entry");

  await startRoundAt(page, "window");
  const [clicked] = cleanHotspotsOf("window");
  const other = hotspotsOf("window").find((id) => id !== clicked)!;
  await answerByTwoTaps(page, clicked);
  await expect(page.locator(`#${other}`)).toHaveAttribute("data-state", "revealed");
  const revealed = await markingOf(page, `#${other}`);

  const all = { revealed, highlighted, candidate, selected };
  expect(new Set(Object.values(all).map((m) => JSON.stringify(m))).size, JSON.stringify(all, null, 2)).toBe(4);

  // 形狀相同的那兩個（一個符號的每一處）不只靠色相分：分不出顏色的人靠線型——revealed 是虛線，高亮是實線。
  expect(await page.locator(`#${other}`).evaluate((el) => getComputedStyle(el).strokeDasharray)).not.toBe("none");
  await page.goto(`${PLAN}?symbol=window`);
  await expect(page.locator("#hs-win-living")).toHaveAttribute("data-state", "highlighted");
  expect(await page.locator("#hs-win-living").evaluate((el) => getComputedStyle(el).strokeDasharray)).toBe("none");
});

// 只有一處的符號，「共 N 處」那一行整行不印：規格主人 2026-09-14 裁定照 M2 票 03 決議 2（票 02 的 Comments）。
test("只有一處的符號（浴缸）：找找看的說明卡不印「共 1 處」", async ({ page }) => {
  await startRoundAt(page, "bathtub");
  await answerByTwoTaps(page, cleanHotspotsOf("bathtub")[0]);
  await showSheetOf(page).click();

  const sheet = sheetOf(page);
  await expect(sheet.getByRole("heading", { name: "浴缸" })).toBeVisible();
  await expect(sheet).not.toContainText("這張圖上共");
});
