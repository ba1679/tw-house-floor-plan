import { expect, test } from "@playwright/test";
import { blockLocalStorage } from "./storage";

const GUIDE = "/guides/furniture-dimensions";
const PRACTICE = `${GUIDE}/practice`;
const CORRECT_ANSWERS = [
  /圖上畫出床和窗/,
  /房間淨長寬、圖中示意床的長寬/,
  /提供臥室甲的淨長與淨寬/,
];

test("從導讀依序完成三題，就近讀理由後自行前進到結束畫面", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "開始學看家具與尺寸", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${GUIDE}/?$`));
  for (const next of ["尺寸依據", "使用空間", "怎麼追問"]) {
    await page.getByRole("button", { name: `下一步：${next}` }).click();
  }
  await page.getByRole("link", { name: "換圖完成三題練習" }).click();
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

  await page.getByRole("button", { name: "下一題：尚缺的資訊" }).click();
  await expect(page.getByText("第 2 題，共 3 題・尚缺的資訊")).toBeVisible();
  await expect(page.getByRole("radio", { name: /房間淨長寬、圖中示意床的長寬/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /圖上畫出床和窗/ })).toHaveCount(0);

  await page.getByRole("radio", { name: /房間淨長寬、圖中示意床的長寬/ }).check();
  await page.getByRole("button", { name: "確認答案" }).click();
  await expect(page.getByRole("status")).toContainText("答對");
  await page.getByRole("button", { name: "下一題：有效追問" }).click();

  await expect(page.getByText("第 3 題，共 3 題・有效追問")).toBeVisible();
  await page.getByRole("radio", { name: /提供臥室甲的淨長與淨寬/ }).check();
  await page.getByRole("button", { name: "確認答案" }).click();
  await expect(page.getByRole("status")).toContainText("答對");
  await page.getByRole("button", { name: "完成練習" }).click();

  const completion = page.getByRole("heading", { level: 2, name: "三題練習完成" });
  await expect(completion).toBeVisible();
  await expect(completion).toBeFocused();
  await expect(page.getByText(/總分|通過|解鎖/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "取得可列印提問清單" })).toHaveAttribute(
    "href",
    "/guides/furniture-dimensions/questions",
  );
  await expect(page.getByRole("link", { name: "回看家具與尺寸導讀" })).toHaveAttribute(
    "href",
    "/guides/furniture-dimensions",
  );

  await page.getByRole("button", { name: "重新練習三題" }).click();
  await expect(page.getByText("第 1 題，共 3 題・有依據的結論")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("從格局頁入口可走完導讀與三題，再前往提問清單", async ({ page }) => {
  await page.goto("/layouts/3b2l_standard");
  await page.getByRole("link", { name: "家具尺寸導讀", exact: true }).click();
  for (const next of ["尺寸依據", "使用空間", "怎麼追問"]) {
    await page.getByRole("button", { name: `下一步：${next}` }).click();
  }
  await page.getByRole("link", { name: "換圖完成三題練習" }).click();

  for (const answer of CORRECT_ANSWERS) {
    await page.getByRole("radio", { name: answer }).check();
    await page.getByRole("button", { name: "確認答案" }).click();
    await expect(page.getByRole("status")).toContainText("答對");
    await page.getByRole("button", { name: /下一題|完成練習/ }).click();
  }

  await page.getByRole("link", { name: "取得可列印提問清單" }).click();
  await expect(page).toHaveURL(new RegExp(`${GUIDE}/questions/?$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("向建商問這四件事");
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

  for (const answer of CORRECT_ANSWERS) {
    await page.getByRole("radio", { name: answer }).check();
    await page.getByRole("button", { name: "確認答案" }).click();
    await page.getByRole("button", { name: /下一題|完成練習/ }).click();
  }
  await expect(page.getByRole("heading", { level: 2, name: "三題練習完成" })).toBeVisible();
});

for (const viewport of [
  { width: 375, height: 812 },
  { width: 320, height: 568 },
  { width: 1280, height: 900 },
]) {
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
