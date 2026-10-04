import { test, expect } from "@playwright/test";
import { waitForViewerReady } from "./viewer-page";
import { blockLocalStorage } from "./storage";

const GUIDE = "/guides/furniture-dimensions";

test("新手可直接讀家具示意的理由，再用鍵盤返回完整格局", async ({ page }) => {
  await page.goto(GUIDE);
  await expect(page.getByRole("heading", { level: 1, name: "學看家具與尺寸" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "畫有床，還不能判斷你的床放得下" })).toBeVisible();
  await expect(page.getByText("局部圖沒有標出床的長寬或房間淨尺寸，也沒有提供你的床有多大，因此還不能判斷你的床是否放得下。", { exact: true })).toBeVisible();

  const back = page.getByRole("link", { name: "回到完整格局", exact: true });
  await back.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/layouts\/3b2l_standard\/?$/);
  await waitForViewerReady(page);
  await expect(page.locator("#dim-overall-w")).toContainText("977 cm");
});

test("圖面文字與依據可用鍵盤讀取，沒有把內部幾何或查證備註當成教材", async ({ page }) => {
  await blockLocalStorage(page);
  const response = await page.goto(GUIDE);
  const html = await response!.text();
  expect(html).not.toContain("phase2-furniture-guide-step1.md");
  expect(html).not.toContain("已核對 FloorPlan 原始資料及 Renderer");

  const description = page.getByText("圖面文字說明", { exact: true });
  await description.focus();
  await page.keyboard.press("Enter");
  const figure = page.getByRole("figure");
  await expect(figure.getByText(/圖上標示主臥及 3.0 坪/)).toBeVisible();
  const accessibleFigure = await figure.ariaSnapshot();
  expect(accessibleFigure).toContain("未標出床的長寬或房間淨尺寸");
  expect(accessibleFigure).not.toMatch(/152|188|288|314|977|782/);

  const evidence = page.getByText("看這一步的依據", { exact: true });
  await evidence.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "本站「三房兩廳」教學範例・主臥局部" })).toBeVisible();
  await expect(page.getByText("這是本站用來練習讀圖的示意範例，沒有對應特定建案或你的家具。", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "核對完整教學範例" })).toHaveAttribute("href", "/layouts/3b2l_standard");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 3 })).not.toBeVisible();
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 320, height: 568 },
  { width: 1280, height: 900 },
]) {
  test(`${viewport.width} × ${viewport.height} 的局部圖完整、文字可讀且自然捲動`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(GUIDE);
    const figure = page.getByRole("figure");
    const drawing = figure.locator("svg");
    const frame = (await drawing.boundingBox())!;

    // 觀察的是已生成圖形的實際螢幕位置，測試不複製裁切／cm 換算算法。
    for (const id of ["f-bed-m", "f-wardrobe-m", "door-master", "win-master"]) {
      const feature = (await drawing.locator(`#${id}`).boundingBox())!;
      expect(feature.x).toBeGreaterThanOrEqual(frame.x);
      expect(feature.y).toBeGreaterThanOrEqual(frame.y);
      expect(feature.x + feature.width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(feature.y + feature.height).toBeLessThanOrEqual(frame.y + frame.height);
    }
    const roomArea = drawing.locator("text").filter({ hasText: /^3\.0 坪$/ });
    const textSize = await roomArea.evaluate((node) => {
      const text = node as SVGTextElement;
      return parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM()!.a;
    });
    expect(textSize).toBeGreaterThanOrEqual(12);
    await expect(drawing.locator("[tabindex]")).toHaveCount(0);

    const heading = (await page.getByRole("heading", { level: 2 }).boundingBox())!;
    if (viewport.width < 860) expect(heading.y).toBeGreaterThan(frame.y + frame.height);
    else expect(heading.x).toBeGreaterThan(frame.x + frame.width);

    const bounds = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
    expect(bounds.width).toBeLessThanOrEqual(viewport.width);
    if (viewport.width < 860) expect(bounds.height).toBeGreaterThan(viewport.height);
    await page.getByText("看這一步的依據", { exact: true }).click();
    await expect(page.getByRole("link", { name: "核對完整教學範例" })).toBeVisible();
  });
}

test("放大兩倍仍可閱讀理由與展開依據，沒有水平溢出", async ({ page }) => {
  await page.goto(GUIDE);
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await page.getByText("看這一步的依據", { exact: true }).click();
  await expect(page.getByRole("heading", { level: 3 })).toBeVisible();
  await expect(page.getByRole("link", { name: "核對完整教學範例" })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
});
