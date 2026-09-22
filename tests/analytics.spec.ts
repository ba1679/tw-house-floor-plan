import { test, expect, type Page } from "@playwright/test";
import { shouldLoadGoogleTagManagerScript } from "@/components/AnalyticsScripts";
import { analyticsEnabledFor } from "@/lib/analytics/gtag";
import { blankSpot, selectByTwoTaps } from "./viewer-page";
import {
  LAYOUT_ID,
  currentTarget,
  startRoundAt,
  cleanHotspotsOf,
  otherThan,
  answerByTwoTaps,
} from "./quiz-play";

type GtagCommand = {
  command: string;
  name?: string;
  params?: Record<string, unknown>;
};

const commandsOf = (page: Page) =>
  page.evaluate<GtagCommand[]>(() =>
    (window.dataLayer ?? []).map((entry) => {
      const args = Array.from(entry as IArguments);
      return {
        command: String(args[0]),
        name: typeof args[1] === "string" ? args[1] : undefined,
        params: args[2] && typeof args[2] === "object" ? (args[2] as Record<string, unknown>) : undefined,
      };
    }),
  );

const symbolViewsOf = async (page: Page) =>
  (await commandsOf(page)).filter((command) => command.command === "event" && command.name === "symbol_view");

async function expectSymbolViews(page: Page, count: number) {
  await expect.poll(() => symbolViewsOf(page)).toHaveLength(count);
  return symbolViewsOf(page);
}

test.describe("Analytics：GA4 bootstrap 與 symbol_view", () => {
  test("Measurement ID 缺席或非法時不啟用 Analytics，也不載入 Google script", () => {
    expect(analyticsEnabledFor("")).toBe(false);
    expect(analyticsEnabledFor("UA-123")).toBe(false);
    expect(analyticsEnabledFor("G-test12345")).toBe(false);
    expect(shouldLoadGoogleTagManagerScript("")).toBe(false);
    expect(shouldLoadGoogleTagManagerScript("UA-123")).toBe(false);
    expect(shouldLoadGoogleTagManagerScript("G-test12345")).toBe(false);

    expect(analyticsEnabledFor("G-TEST12345")).toBe(true);
    expect(shouldLoadGoogleTagManagerScript("G-TEST12345")).toBe(false);
    expect(shouldLoadGoogleTagManagerScript("G-ABC123")).toBe(true);
  });

  test("Consent default 在 config 與 event 前，且測試環境不打 Google script", async ({ page }) => {
    const googleRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("googletagmanager.com")) googleRequests.push(request.url());
    });

    await page.goto("/symbols/window");
    await expectSymbolViews(page, 1);
    const commands = await commandsOf(page);
    const firstConfig = commands.findIndex((command) => command.command === "config");
    const firstEvent = commands.findIndex((command) => command.command === "event");
    const consentIndexes = commands
      .map((command, index) => (command.command === "consent" ? index : -1))
      .filter((index) => index >= 0);

    expect(consentIndexes).toHaveLength(2);
    expect(consentIndexes.every((index) => index < firstConfig)).toBe(true);
    expect(consentIndexes.every((index) => index < firstEvent)).toBe(true);
    expect(commands[0].params).toMatchObject({
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    expect(commands[1].params).toMatchObject({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      region: ["TW"],
    });
    expect(googleRequests).toEqual([]);
  });

  test("Symbol 頁 hydration 後送一次，query 只決定 search/category source", async ({ page }) => {
    await page.goto("/symbols/window");
    await expectSymbolViews(page, 1);
    await expect((await symbolViewsOf(page))[0].params).toEqual({
      symbol_id: "window",
      source: "search",
    });

    await page.goto("/symbols/window?from=category");
    await expectSymbolViews(page, 1);
    await expect((await symbolViewsOf(page))[0].params).toEqual({
      symbol_id: "window",
      source: "category",
    });

    await page.goto("/symbols/window?from=campaign");
    await expectSymbolViews(page, 1);
    await expect((await symbolViewsOf(page))[0].params).toEqual({
      symbol_id: "window",
      source: "search",
    });
  });

  test("搜尋與分類入口分別帶 from=search / from=category", async ({ page }) => {
    await page.goto("/");
    const homeSearch = page.getByRole("search");
    await homeSearch.getByRole("searchbox").fill("窗");
    await expect(homeSearch.locator('a[href="/symbols/window?from=search"]')).toBeVisible();

    await page.goto("/categories/door_window");
    await expect(page.locator('a[href="/symbols/window?from=category"]')).toBeVisible();
  });

  test("自由看圖只有 InfoSheet 成功打開時送 layout event，重開才再送", async ({ page }) => {
    await page.goto(`/layouts/${LAYOUT_ID}`);

    const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
    await page.mouse.click(blankSpot(frame).x, blankSpot(frame).y);
    await expect(page.getByRole("status")).toContainText("換個地方");
    await expect(await symbolViewsOf(page)).toHaveLength(0);

    await selectByTwoTaps(page, "hs-win-living");
    let events = await expectSymbolViews(page, 1);
    expect(events[0].params).toEqual({
      symbol_id: "window",
      source: "layout",
      layout_id: LAYOUT_ID,
      hotspot_id: "hs-win-living",
    });

    await page.getByRole("button", { name: /其他位置/ }).click();
    await expect(page.locator("#info-sheet")).toContainText("目前第 2 處");
    expect(await symbolViewsOf(page)).toHaveLength(1);

    await page.getByRole("button", { name: "關閉說明" }).click();
    await selectByTwoTaps(page, "hs-win-living");
    events = await expectSymbolViews(page, 2);
    expect(events[1].params).toEqual(events[0].params);
  });

  test("找找看答對不自動送；按看說明才送 quiz event", async ({ page }) => {
    await startRoundAt(page, "window");
    await answerByTwoTaps(page, cleanHotspotsOf("window")[0]);
    await expect(await symbolViewsOf(page)).toHaveLength(0);

    await page.getByRole("button", { name: "看說明" }).click();
    const events = await expectSymbolViews(page, 1);
    expect(events[0].params).toEqual({
      symbol_id: "window",
      source: "quiz",
      layout_id: LAYOUT_ID,
      hotspot_id: cleanHotspotsOf("window")[0],
    });
  });

  test("找找看答錯自動送題目 symbol 與實際 hotspot，兩者可以不同", async ({ page }) => {
    await startRoundAt(page, "window");
    const target = await currentTarget(page);
    const picked = otherThan(target);
    const pickedHotspot = cleanHotspotsOf(picked)[0];

    await answerByTwoTaps(page, pickedHotspot);

    const events = await expectSymbolViews(page, 1);
    expect(events[0].params).toEqual({
      symbol_id: target,
      source: "quiz",
      layout_id: LAYOUT_ID,
      hotspot_id: pickedHotspot,
    });
    expect(picked).not.toBe(target);
  });
});
