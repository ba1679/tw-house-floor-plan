import { test, expect, type Page } from "@playwright/test";
import { selectByTwoTaps } from "./viewer-page";
import { answerByTwoTaps, cleanHotspotsOf, nextOf, startRoundAt, symbolOf } from "./quiz-play";

const REPRESENTATIVE_PAGES = [
  { label: "home", path: "/", heading: /^一張平面圖，\s*你真的\s*看得懂嗎？$/ },
  { label: "floorplan", path: "/layouts/3b2l_standard", heading: "三房兩廳" },
  { label: "symbol", path: "/symbols/window", heading: /窗/ },
  { label: "category", path: "/categories/door_window", heading: /門窗/ },
  { label: "quiz", path: "/layouts/3b2l_standard/quiz", heading: /找找看/ },
] as const;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows, label).toBe(false);
}

async function gotoRepresentative(page: Page, path: string) {
  await page.goto(path);
  await page.locator("body").waitFor();
}

test.describe("M5 RWD representatives", () => {
  for (const size of [{ width: 375, height: 812 }, { width: 320, height: 568 }]) {
    for (const correct of [true, false]) {
      test(`找找看結果與說明卡完整開合仍保留圖面與下一題（${size.width} × ${size.height}，${correct ? "答對" : "答錯"}）`, async ({ page }) => {
        await page.setViewportSize(size);
        const target = "door_single_swing";
        await startRoundAt(page, target, { notLast: true });
        await answerByTwoTaps(page, cleanHotspotsOf(correct ? target : "door_double_swing")[0]);
        const result = page.getByRole("region", { name: "作答結果" });
        const sheet = page.locator("#info-sheet");
        if (correct) await page.getByRole("button", { name: "看說明" }).click();
        await sheet.evaluate(async (element) => {
          element.getBoundingClientRect();
          await Promise.all(element.getAnimations().map((animation) => animation.finished));
        });
        // 完整內容已放得下時本來就沒有展開控制；有溢出的卡才走展開與收合。
        const stages = await page.getByRole("button", { name: "展開完整內容" }).isVisible()
          ? ["open", "expanded", "collapsed"] : ["open"];
        for (const stage of stages) {
          if (stage === "expanded") await page.getByRole("button", { name: "展開完整內容" }).click();
          if (stage === "collapsed") await page.getByRole("button", { name: "收合看平面圖" }).click();
          await sheet.evaluate(async (element) => {
            element.getBoundingClientRect();
            await Promise.all(element.getAnimations().map((animation) => animation.finished));
          });
          await expect(result).toBeInViewport({ ratio: 1 });
          await expect(nextOf(page)).toBeInViewport({ ratio: 1 });
          await expect(sheet.getByRole("heading", { name: symbolOf(target).name })).toBeInViewport({ ratio: 1 });
          const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
          const card = (await sheet.boundingBox())!;
          const feedback = (await result.boundingBox())!;
          expect(frame.height, stage).toBeGreaterThanOrEqual(84);
          expect(frame.y + frame.height).toBeLessThanOrEqual(feedback.y);
          expect(feedback.y + feedback.height).toBeLessThanOrEqual(card.y);
          await expectNoHorizontalOverflow(page, stage);
          expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false);
        }
        if (!correct) {
          const difference = symbolOf(target).confused_with.find((other) => other.symbol_id === "door_double_swing")!.difference;
          const note = sheet.locator('[data-section="note"]');
          await expect(note).toContainText(difference);
          const body = sheet.locator("#info-sheet-body");
          expect((await body.boundingBox())!.height, "正文至少能讀兩行，不能只剩裁切縫隙").toBeGreaterThanOrEqual(48);
          await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
          expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        }
        await page.getByRole("button", { name: "關閉說明" }).click();
        await expect(sheet).toBeHidden();
        await expect(result).toBeInViewport({ ratio: 1 });
        await expect(nextOf(page)).toBeInViewport({ ratio: 1 });
        await nextOf(page).click();
        await expect(result).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false);
      });
    }
  }
  test("自由看圖在手機與桌機完整開合說明卡，動畫後仍是一個螢幕的版面列", async ({ page }) => {
    for (const size of [
      { width: 375, height: 812 },
      { width: 320, height: 568 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/layouts/3b2l_standard");
      await selectByTwoTaps(page, "hs-canopy-master");
      const sheet = page.locator("#info-sheet");
      for (const stage of ["open", "expanded", "collapsed"]) {
        if (stage === "expanded") await page.getByRole("button", { name: "展開完整內容" }).click();
        if (stage === "collapsed") await page.getByRole("button", { name: "收合看平面圖" }).click();
        await sheet.evaluate(async (element) => {
          element.getBoundingClientRect();
          await Promise.all(element.getAnimations().map((animation) => animation.finished));
        });
        await expect(sheet.getByRole("heading", { name: "雨遮" })).toBeInViewport({ ratio: 1 });
        const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
        const card = (await sheet.boundingBox())!;
        expect(frame.height, `${size.width} / ${stage}`).toBeGreaterThanOrEqual(84);
        expect(frame.y + frame.height).toBeLessThanOrEqual(card.y);
        expect(card.y + card.height).toBeLessThanOrEqual(size.height + 1);
        await expectNoHorizontalOverflow(page, `${size.width} / ${stage}`);
        expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false);
      }
      await page.getByRole("button", { name: "關閉說明" }).click();
      await expect(sheet).toBeHidden();
      await expect(page.getByRole("contentinfo")).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(false);
    }
  });

  test("五種代表頁在 375 × 812 下主要內容與入口可見", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    for (const target of REPRESENTATIVE_PAGES) {
      await gotoRepresentative(page, target.path);
      await expect(page.getByRole("heading", { level: 1, name: target.heading }), target.label).toBeVisible();
      await expectNoHorizontalOverflow(page, target.label);
    }
  });

  test("五種代表頁在 1280 × 900 下沒有手機固定尺寸斷裂", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const target of REPRESENTATIVE_PAGES) {
      await gotoRepresentative(page, target.path);
      await expect(page.getByRole("heading", { level: 1, name: target.heading }), target.label).toBeVisible();
      await expectNoHorizontalOverflow(page, target.label);
    }

    await gotoRepresentative(page, "/layouts/3b2l_standard");
    const viewport = page.locator("#floorplan-viewport");
    const viewportBox = await viewport.boundingBox();
    expect(viewportBox?.width).toBeGreaterThan(400);
    expect(viewportBox?.height).toBeGreaterThan(300);

    await selectByTwoTaps(page, "hs-win-living");
    await expect(page.locator("#info-sheet")).toBeVisible();
    await page.getByRole("button", { name: "關閉說明" }).click();
    await expect(page.locator("#info-sheet")).toBeHidden();
  });

  test("五種代表頁在 320px 寬時沒有水平捲動", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });

    for (const target of REPRESENTATIVE_PAGES) {
      await gotoRepresentative(page, target.path);
      await expect(page.getByRole("heading", { level: 1, name: target.heading }), target.label).toBeVisible();
      await expectNoHorizontalOverflow(page, target.label);
    }
  });

  test("找找看代表頁在手機與桌面都能開始一局且圖框可操作", async ({ page }) => {
    for (const viewportSize of [
      { width: 375, height: 812 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewportSize);
      await gotoRepresentative(page, "/layouts/3b2l_standard/quiz");

      await page.getByRole("button", { name: "開始" }).click();
      await expect(page.locator("#quiz-progress")).toHaveText("第 1 / 7 題");
      const viewport = page.locator("#floorplan-viewport");
      const box = await viewport.boundingBox();
      expect(box?.width, `${viewportSize.width} width`).toBeGreaterThan(0);
      expect(box?.height, `${viewportSize.width} height`).toBeGreaterThan(0);
    }
  });
});
