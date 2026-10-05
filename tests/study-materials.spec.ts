import { expect, test } from "@playwright/test";

const STUDY = "/study/furniture-dimensions";

test("第二張陌生圖只給讀者可見條件與三項無提示任務", async ({ page }) => {
  await page.goto(STUDY);

  await expect(page.getByRole("heading", { level: 1, name: "另一張局部圖" })).toBeVisible();
  const figure = page.getByRole("figure");
  await expect(figure.locator("#study-bed")).toBeVisible();
  await expect(figure.locator("#study-desk")).toBeVisible();
  await expect(figure.locator("#study-bedroom-door")).toBeVisible();
  await expect(figure.locator("#study-window")).toBeVisible();
  await expect(figure.locator("#practice-bed")).toHaveCount(0);
  await expect(figure.locator("#dim-overall-w, #dim-overall-h")).toHaveCount(0);
  await expect(page.getByRole("listitem").filter({ hasText: "有圖面依據的觀察" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "尚未確認的資訊" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "能補足這項資訊的問題" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/正解|參考答案|床一定放得下|淨長寬/);
});

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 1280, height: 900 },
]) {
  test(`${viewport.width} × ${viewport.height} 陌生範例完整可讀，沒有橫向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(STUDY);
    const drawing = page.getByRole("figure").locator("svg");
    const frame = (await drawing.boundingBox())!;
    for (const id of ["study-bed", "study-desk", "study-bedroom-door", "study-window"]) {
      const feature = (await drawing.locator(`#${id}`).boundingBox())!;
      expect(feature.x).toBeGreaterThanOrEqual(frame.x);
      expect(feature.y).toBeGreaterThanOrEqual(frame.y);
      expect(feature.x + feature.width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(feature.y + feature.height).toBeLessThanOrEqual(frame.y + frame.height);
    }
    for (const label of ["臥室乙 B.R", "4.8 坪"]) {
      const text = drawing.locator("#room-labels text").filter({ hasText: label });
      const renderedFontSize = await text.evaluate((element) => {
        const scale = (element as SVGGraphicsElement).getScreenCTM()!;
        return Number.parseFloat(getComputedStyle(element).fontSize) * Math.hypot(scale.a, scale.b);
      });
      expect(renderedFontSize).toBeGreaterThanOrEqual(12);
    }
    const bed = (await drawing.locator("#study-bed").boundingBox())!;
    const roomName = (await drawing.locator("#room-labels text").filter({ hasText: "臥室乙 B.R" }).boundingBox())!;
    expect(roomName.x).toBeGreaterThanOrEqual(bed.x + bed.width + 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
