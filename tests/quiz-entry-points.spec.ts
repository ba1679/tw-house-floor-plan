import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { LAYOUT_ID, PLAN, QUIZ, floorplans } from "./quiz-play";

// 找找看的入口（M4 票 06）：平面圖頁一個、首頁每張有可出題符號的圖一個，符號頁沒有。
// 期望值從資料算：哪幾張圖有入口，由 floorplan 上有沒有熱區決定，不寫死 3b2l_standard。

/** 有可出題符號的圖（CONTEXT.md「可出題符號」的定義本身）：只有它們有找找看頁，也只有它們有入口。 */
const withQuiz = floorplans.filter((fp) => fp.hotspots.some((h) => h.symbol_id !== null));

const quizHref = (layoutId: string) => `/layouts/${layoutId}/quiz`;
const entryOf = (page: Page, layoutId: string) => page.locator(`main a[href="${quizHref(layoutId)}"]`);

test.describe("平面圖頁的入口", () => {
  test("有一個連往這張圖找找看頁的入口，按下去就到開場", async ({ page }) => {
    await page.goto(PLAN);

    const entry = entryOf(page, LAYOUT_ID);
    await expect(entry).toHaveCount(1);
    await expect(entry).toBeVisible();

    await entry.click();
    await expect(page).toHaveURL(QUIZ);
    await expect(page.getByRole("button", { name: "開始" })).toBeVisible();
  });

  // 看得見的膠囊只有 32px（不撐高標題列），點擊範圍靠上下透明的框撐到 44px（PRD §9、DESIGN.md「找找看入口」）。
  test("入口點得到：點擊範圍至少 44 × 44", async ({ page }) => {
    await page.goto(PLAN);
    const box = (await entryOf(page, LAYOUT_ID).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  // 這一頁是 100dvh 的版面，每一列都從平面圖的可視帶挖高度（ADR-0003）：入口要擺在既有的列裡，框一 px 都不能少。
  // 「加之前」用同一頁把入口藏起來量——入口若撐高了它所在的那一列，藏起來之後框就會變高。
  // 三種狀態都量：卡片沒開時框下面本來就有留白，只量那一種的話，撐高了也看不出來。
  test("加了入口之後，375 × 812 下檢視器的框高度不變：卡片沒開、開著、展開都量", async ({ page }) => {
    await page.goto(PLAN);
    const entry = entryOf(page, LAYOUT_ID);
    const frame = page.locator("#floorplan-viewport");
    await expect(entry).toBeVisible();

    const withAndWithout = async () => {
      const shown = (await frame.boundingBox())!.height;
      await entry.evaluate((el) => ((el as HTMLElement).style.display = "none"));
      const hidden = (await frame.boundingBox())!.height;
      await entry.evaluate((el) => ((el as HTMLElement).style.display = ""));
      return { shown, hidden };
    };

    const closed = await withAndWithout();
    expect(closed.shown, "卡片沒開").toBeCloseTo(closed.hidden, 1);

    // 卡片用鍵盤開：這條問的是版面，不是兩段式點擊。
    const sheet = page.locator("#info-sheet");
    await page.locator("#hs-door-entry").focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible();
    const open = await withAndWithout();
    expect(open.shown, "卡片開著").toBeCloseTo(open.hidden, 1);

    // 雨遮是唯一有注意事項的符號，卡片塞不下才展得開。展開時框只剩一條，這一格最經不起多挖。
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await page.locator("#hs-canopy-master").focus();
    await page.keyboard.press("Enter");
    const expand = page.getByRole("button", { name: /展開完整內容/ });
    await expand.click();
    await expect(expand).toBeHidden();
    // M6 lets the sheet and viewport finish their shared structural transition
    // before comparing the two otherwise identical title-row layouts.
    await page.waitForTimeout(200);
    const expanded = await withAndWithout();
    expect(expanded.shown, "展開時框被壓到 0，這一格什麼都量不出來").toBeGreaterThan(0);
    expect(expanded.shown, "卡片展開").toBeCloseTo(expanded.hidden, 1);
  });
});

test.describe("首頁的入口", () => {
  test("每張有可出題符號的圖各一個入口，帶著格局名，連到那張圖的找找看頁", async ({ page }) => {
    expect(withQuiz.length, "資料裡沒有任何一張有熱區的圖，這條測不到東西").toBeGreaterThan(0);
    await page.goto("/");

    const hrefs = await page
      .locator('main a[href$="/quiz"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect([...hrefs].sort()).toEqual(withQuiz.map((fp) => quizHref(fp.id)).sort());

    // 讀者按下去之前就知道是哪一張圖的找找看——與「開始探索三房兩廳」同一個理由。
    for (const fp of withQuiz) await expect(entryOf(page, fp.id)).toContainText(fp.name);

    await entryOf(page, LAYOUT_ID).click();
    await expect(page).toHaveURL(QUIZ);
  });
});

// 符號頁的轉換點是把搜尋流量帶進產品核心的唯一入口（PRD §6.2.1），不該被第二顆按鈕分散。
// 掃建置產物裡的每一張符號頁，不列舉符號：列舉的清單明天多一個符號時不會紅，只會少測一頁。
test("符號頁上沒有連往找找看頁的連結", () => {
  const pages = readdirSync("out/symbols").filter((name) => name.endsWith(".html"));
  expect(pages.length).toBeGreaterThan(0);

  for (const name of pages) {
    const html = readFileSync(`out/symbols/${name}`, "utf8");
    expect(html, `symbols/${name}`).not.toMatch(/href="[^"]*\/quiz"/);
  }
});
