import { expect, test } from "@playwright/test";
import { blockLocalStorage } from "./storage";

const GUIDE = "/guides/furniture-dimensions";
const PRACTICE = `${GUIDE}/practice`;

test("從導讀進入陌生局部圖，能改選、確認、讀理由並重試", async ({ page }) => {
  await page.goto(GUIDE);
  for (const next of ["尺寸依據", "使用空間", "怎麼追問"]) {
    await page.getByRole("button", { name: `下一步：${next}` }).click();
  }
  await page.getByRole("link", { name: "換圖練習第一題" }).click();
  await expect(page).toHaveURL(new RegExp(`${PRACTICE}/?$`));
  await expect(page.getByRole("heading", { level: 1, name: "判讀練習" })).toBeVisible();
  await expect(page.getByRole("figure").locator("#practice-bed")).toBeVisible();
  await expect(page.getByText("答錯", { exact: true })).toHaveCount(0);
  await expect(page.getByText("答對", { exact: true })).toHaveCount(0);

  await page.getByRole("radio", { name: /圖上有床，自己的雙人床一定放得下/ }).check();
  await page.getByRole("radio", { name: /圖上畫出床和窗/ }).check();
  await page.getByRole("radio", { name: /圖上有床，自己的雙人床一定放得下/ }).check();
  await page.getByRole("button", { name: "確認答案" }).click();
  await expect(page.getByRole("status")).toContainText("答錯");
  await expect(page.getByRole("status")).toContainText("圖上沒有標出房間淨尺寸或床的長寬");
  await expect(page.getByRole("radio", { name: /圖上畫出床和窗/ })).toBeDisabled();

  await page.getByRole("button", { name: "重試這一題" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("radio", { name: /圖上畫出床和窗/ }).check();
  await page.getByRole("button", { name: "確認答案" }).click();
  await expect(page.getByRole("status")).toContainText("答對");
});

test("作答前等價文字只描述圖上資訊，判讀不改找找看的熟悉度", async ({ page }) => {
  await page.goto(GUIDE);
  await page.evaluate(() => localStorage.setItem("fp:progress:v1", '{"sentinel":"unchanged"}'));
  await page.goto(PRACTICE);

  const figure = page.getByRole("figure");
  await expect(figure.locator("#practice-bed")).toBeVisible();
  await expect(figure.locator("#practice-window")).toBeVisible();
  await expect(figure.locator("#dim-overall-w")).toHaveCount(0);
  await expect(figure.locator("#dim-overall-h")).toHaveCount(0);
  await figure.getByText("圖面文字說明").click();
  const description = await figure.ariaSnapshot();
  expect(description).toContain("沒有標出房間淨長寬");
  expect(description).not.toMatch(/520 cm|360 cm|正解|答對|答錯/);
  await expect(page.getByText("圖上沒有標出房間淨尺寸或床的長寬", { exact: false })).toHaveCount(0);

  await page.getByRole("radio", { name: /圖上有床，自己的雙人床一定放得下/ }).check();
  await page.getByRole("button", { name: "確認答案" }).click();
  expect(await page.evaluate(() => localStorage.getItem("fp:progress:v1"))).toBe('{"sentinel":"unchanged"}');
});

test("本機儲存被封鎖時，鍵盤仍能選答、讀取回饋與重試", async ({ page }) => {
  await blockLocalStorage(page);
  await page.goto(PRACTICE);
  const option = page.getByRole("radio", { name: /圖上畫出床和窗/ });
  await option.focus();
  await page.keyboard.press("Space");
  await expect(option).toBeChecked();
  const confirm = page.getByRole("button", { name: "確認答案" });
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("答對");
  await page.getByRole("button", { name: "重試這一題" }).click();
  await expect(confirm).toBeDisabled();
});

for (const viewport of [{ width: 375, height: 812 }, { width: 320, height: 568 }]) {
  test(`${viewport.width} × ${viewport.height} 局部圖與選項可操作，沒有橫向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(PRACTICE);
    const drawing = page.getByRole("figure").locator("svg");
    const frame = (await drawing.boundingBox())!;
    for (const id of ["practice-bed", "practice-window", "practice-door"]) {
      const feature = (await drawing.locator(`#${id}`).boundingBox())!;
      expect(feature.x).toBeGreaterThanOrEqual(frame.x);
      expect(feature.y).toBeGreaterThanOrEqual(frame.y);
      expect(feature.x + feature.width).toBeLessThanOrEqual(frame.x + frame.width);
      expect(feature.y + feature.height).toBeLessThanOrEqual(frame.y + frame.height);
    }
    const option = page.getByRole("radio", { name: /圖上畫出床和窗/ });
    expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}
