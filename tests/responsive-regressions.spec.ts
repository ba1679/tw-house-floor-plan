import { test, expect, type Page } from "@playwright/test";
import { selectByTwoTaps } from "./viewer-page";

const REPRESENTATIVE_PAGES = [
  { label: "home", path: "/", heading: "一張平面圖，你真的看得懂嗎？" },
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
