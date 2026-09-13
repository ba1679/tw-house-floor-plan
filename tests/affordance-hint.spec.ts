import { test, expect, type Page } from "@playwright/test";
import { markingOf, painted } from "./viewer-page";

// 這個檢視器最危險的失敗不是「點不到」，是**看起來不能點**：整張圖都是熱區卻毫無提示，
// 使用者會把它當成一張靜態圖片直接離開（PRD §6.1.2）。這一組測的就是「他知道可以點」。
//
// 提示分兩層，兩層都要測：
//  - 一句只說一次的引導（user story 22、23）。它只對第一次進站的人說。
//  - 圖上那層非常克制的標示。**回訪的人只剩下它**，手機上也只剩下它（沒有 hover），
//    所以它必須自己就站得住。

const PLAN = "/layouts/3b2l_standard";

/** 引導的文案。v0.5 改過：對上兩段式，不再是舊版的「點擊圖上的標記」（PRD §6.1.2）。 */
const TAP_HINT = "點圖上任何一個位置，我們會放大讓你看清楚";

const statusOf = (page: Page) => page.getByRole("status");
const layerOf = (page: Page) => page.locator("#hotspot-layer");

// 熱區實際被畫成什麼樣子（`markingOf`）、有沒有真的畫出來（`painted`）收在 `viewer-page.ts`：
// 票 08 的高亮要與這一層提示分得開，問的是同一件事。

const motionOf = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    return { count: style.animationIterationCount, duration: style.animationDuration };
  });

/**
 * 等 client 真的接手。
 *
 * 「這個人以前來過嗎」只有瀏覽器答得出來（答案在 localStorage 裡），SSG 出來的靜態 HTML
 * 因此不帶 `data-hint`——它一出現就表示 client 已經問過並決定了。少了這道等待，
 * 「回訪不該看到引導」會在 hydrate 之前就先量到一個空的狀態列，於是**用錯的理由通過**。
 *
 * 它只是一道閘門，不是斷言的對象：每條測試要斷言的是使用者看得到的東西
 * （狀態列的字、熱區的顏色），不是元件把 state 寫成什麼屬性（spec §Testing Decisions）。
 */
async function decided(page: Page) {
  await expect(layerOf(page)).toHaveAttribute("data-hint", /on|off/);
}

test("第一次進站：一句話告訴使用者這張圖可以點，而且不必點準", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);

  await expect(statusOf(page)).toContainText(TAP_HINT);
  // 舊文案（「點擊圖上的標記」）要求使用者點準一個比指尖還小的東西，
  // 那正是兩段式要拆掉的預設（PRD §6.1.2 v0.5）。
  await expect(statusOf(page)).not.toContainText("標記");
});

test("引導只說一次：同一台瀏覽器再進來就不見了", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);
  await expect(statusOf(page)).toContainText(TAP_HINT);

  await page.reload();

  await decided(page);
  await expect(statusOf(page)).not.toContainText(TAP_HINT);
});

test("清掉 localStorage，引導就當你是第一次來", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);
  await expect(statusOf(page)).toContainText(TAP_HINT);

  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await decided(page);
  await expect(statusOf(page)).toContainText(TAP_HINT);
});

test("手指一碰到圖，引導就退場——它的話已經說完了", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);

  const door = page.locator("#hs-door-entry");
  const box = (await door.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(statusOf(page)).not.toContainText(TAP_HINT);
});

test("熱區看得出是可以點的，而且不靠面積——回訪的人只剩下這一層", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);

  // 回訪：引導那句話沒有了，圖上的標示是他唯一剩下的線索——手機上更是如此（沒有 hover）。
  await page.reload();
  await decided(page);
  await expect(statusOf(page)).not.toContainText(TAP_HINT);

  const marking = await markingOf(page, "#hs-door-entry");
  expect(painted(marking.fill), "熱區沒有底色").toBe(true);
  // 光有底色不算數：底色的可見度跟面積成正比，而這張圖要教的符號正好都很小
  // （375px 全圖下大門的短邊只有 6.9px）。細邊不吃面積，小熱區靠它才看得出來。
  expect(painted(marking.stroke), "熱區沒有細邊，小熱區等於沒有提示").toBe(true);
  expect(Number.parseFloat(marking.strokeWidth)).toBeGreaterThan(0);
});

test("提示不會一直動：熱區上沒有停不下來的動效", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);

  // 「不得持續閃爍」是明令（PRD §6.1.2）——這張圖本身是學習對象，
  // 一個永遠在動的東西會讓人沒辦法安靜地看線條。
  //
  // 量在 **rect** 上，不只量群組：提示的每一條規則都掛在 `.hotspots rect`，
  // 只量群組是量一個沒有人設過動畫的元素，那樣這條測試永遠會過。
  for (const selector of ["#hotspot-layer", "#hs-door-entry", "#hs-col-nw"]) {
    const motion = await motionOf(page, selector);
    expect(motion.count, `${selector} 的動效停不下來`).not.toBe("infinite");
    const cycles = Number(motion.count) || 0;
    const seconds = Number.parseFloat(motion.duration) || 0;
    expect(cycles * seconds, `${selector} 的動效太久`).toBeLessThan(15);
  }
});

test("選到符號之後，圖上那層標示收起來，不跟它搶著被看", async ({ page }) => {
  await page.goto(PLAN);
  await decided(page);

  // 兩段式：第一段點大門、第二段確認。
  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
  const zoomed = (await door.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(door).toHaveAttribute("data-state", "selected");

  // 說明卡開著時使用者正在讀那一個符號。其餘 36 個還標著只是雜訊，而這張圖本身就是
  // 學習對象（票 04 confirmTap 的同一條理由）；第二段也只認第一段圈出的候選，
  // 把其餘 36 個標起來還會是騙人的（PRD §11 #19）。
  const marking = await markingOf(page, "#hs-win-living");
  expect(painted(marking.fill), "說明卡開著時，沒被選到的熱區還有底色").toBe(false);
  expect(painted(marking.stroke), "說明卡開著時，沒被選到的熱區還有細邊").toBe(false);
});

test.describe("桌機 hover", () => {
  test.use({ hasTouch: false, viewport: { width: 1280, height: 900 } });

  test("游標停在熱區上，那一個更明顯", async ({ page }) => {
    await page.goto(PLAN);
    await decided(page);
    // 手機沒有 hover，這條只對有精準游標的機器成立。
    const hoverable = await page.evaluate(
      () => matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
    test.skip(!hoverable, "這台機器沒有 hover，靜態標示是它唯一的提示");

    // 回訪時也保有 hover 提示。
    await page.reload();
    await decided(page);

    const door = page.locator("#hs-door-entry");
    const box = (await door.boundingBox())!;
    const resting = await markingOf(page, "#hs-door-entry");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    expect((await markingOf(page, "#hs-door-entry")).fill).not.toBe(resting.fill);

    // 游標離開就回到原本的樣子：hover 是「游標在這裡」，不是一個會留下來的選取狀態。
    await page.mouse.move(box.x + box.width / 2, box.y - 200);
    expect((await markingOf(page, "#hs-door-entry")).fill).toBe(resting.fill);
  });

  test("第二段挑候選時，游標停在哪一個上面就換哪一個更明顯", async ({ page }) => {
    await page.goto(PLAN);
    await decided(page);

    // 第一段：點客廳西北角，柱與壓在它上面的窗都進候選。
    const column = page.locator("#hs-col-nw");
    const col = (await column.boundingBox())!;
    await page.mouse.click(col.x + col.width / 2, col.y + col.height / 2);
    await expect(column).toHaveAttribute("data-state", "candidate");

    // 最壞情況要在 9 個重疊的候選裡挑一個（spec §Testing Decisions 案例 4）。
    // 桌機使用者有精準游標，游標底下是哪一個就該看得出來，不必靠猜。
    const zoomed = (await column.boundingBox())!;
    const resting = await markingOf(page, "#hs-col-nw");
    await page.mouse.move(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
    expect((await markingOf(page, "#hs-col-nw")).fill).not.toBe(resting.fill);
  });
});

test("瀏覽器封鎖 localStorage 時，引導與兩段式選取仍可使用", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto(PLAN);
  await decided(page);
  await expect(statusOf(page)).toContainText(TAP_HINT);

  const door = page.locator("#hs-door-entry");
  const before = (await door.boundingBox())!;
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
  await expect(statusOf(page)).not.toContainText(TAP_HINT);

  const zoomed = (await door.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(door).toHaveAttribute("data-state", "selected");
});
