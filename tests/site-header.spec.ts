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
    for (const path of pages) {
      await page.goto(path);
      const home = page.getByRole("link", { name: "回首頁：平面圖教學" });
      await expect(home).toBeVisible();
      const box = (await home.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(home).toHaveAttribute("href", "/");
    }
  });

  test("首頁沒有第二個不可點的同名 wordmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("平面圖教學", { exact: true })).toHaveCount(1);
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
