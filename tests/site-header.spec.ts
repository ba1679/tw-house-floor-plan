import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/symbols/window",
  "/categories/structure",
  "/layouts/3b2l_standard",
  "/layouts/3b2l_standard/quiz",
];

test.describe("全站品牌 header", () => {
  test("每一種內容頁都有同一個可回首頁的品牌入口", async ({ page }) => {
    for (const size of [{ width: 375, height: 812 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      for (const path of pages) {
        await page.goto(path);
        const home = page.getByRole("link", { name: "回首頁：拼厝" });
        await expect(home).toBeVisible();
        await expect(home.getByText("拼厝", { exact: true })).toBeVisible();
        await expect(home.getByText("Phin-Chhù", { exact: true })).toBeVisible();
        await expect(home.getByRole("img", { name: "拼厝", exact: true })).toBeVisible();
        const box = (await home.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        await expect(home).toHaveAttribute("href", "/");
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), `${path} / ${size.width}`).toBe(false);
      }
    }
  });

  test("品牌連結、搜尋輸入與開始按鈕可用鍵盤抵達，焦點保留黑白雙環", async ({ page }) => {
    const targets = [
      { path: "/", locator: page.getByRole("link", { name: "回首頁：拼厝" }) },
      { path: "/", locator: page.getByRole("searchbox") },
      { path: "/layouts/3b2l_standard/quiz", locator: page.getByRole("button", { name: "開始", exact: true }) },
    ];
    for (const { path, locator } of targets) {
      await page.goto(path);
      for (let step = 0; step < 10; step++) {
        await page.keyboard.press("Tab");
        if (await locator.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(locator).toBeFocused();
      const shadow = await locator.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadow).toContain("rgb(255, 255, 255) 0px 0px 0px 2px");
      expect(shadow).toContain("rgb(0, 0, 0) 0px 0px 0px 4px");
      const box = (await locator.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("首頁沒有第二個不可點的同名 wordmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("拼厝", { exact: true })).toHaveCount(1);
  });

  test("header 是米白閱讀面的一列，以深褐細框分隔內容", async ({ page }) => {
    await page.goto("/symbols/window");
    const header = page.getByRole("banner");
    await expect(header).toHaveCSS("background-color", "rgb(250, 248, 240)");
    await expect(header).toHaveCSS("border-bottom-color", "rgb(90, 62, 41)");
    await expect(header).toHaveCSS("box-shadow", "none");
    expect(await header.evaluate((el) => getComputedStyle(el).position)).not.toMatch(/fixed|sticky|absolute/);
    await expect(header.getByRole("link")).toHaveCount(1);

    const headerBox = (await header.boundingBox())!;
    const mainBox = (await page.getByRole("main").boundingBox())!;
    expect(mainBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  });

  test("窄而矮的平面圖與找找看頁仍沒有文件捲動", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    for (const path of ["/layouts/3b2l_standard", "/layouts/3b2l_standard/quiz"]) {
      await page.goto(path);
      const scrollable = await page.evaluate(
        () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
      );
      expect(scrollable, `${path} 被 header 撐成可捲頁`).toBe(false);
    }
  });
});
