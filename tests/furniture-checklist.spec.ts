import { expect, test } from "@playwright/test";

const GUIDE = "/guides/furniture-dimensions";
const CHECKLIST = `${GUIDE}/questions`;

test("第四步把資訊缺口轉成四個追問，並能返回前三步與完整格局", async ({ page }) => {
  await page.goto(GUIDE);
  for (const topic of ["尺寸依據", "使用空間"]) {
    await page.getByRole("button", { name: `下一步：${topic}` }).click();
  }
  const next = page.getByRole("button", { name: "下一步：怎麼追問" });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 2, name: "缺少資料時，怎麼向建商追問？" })).toBeFocused();
  await expect(page.getByRole("list", { name: "可帶去詢問的問題" }).getByRole("listitem")).toHaveCount(4);
  await page.getByText("看這一步的依據", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "本站「三房兩廳」教學範例・追問依據" })).toBeVisible();
  await expect(page.getByRole("link", { name: "開啟可列印提問清單" })).toHaveAttribute("href", CHECKLIST);
  await expect(page.getByRole("link", { name: "取得可列印提問清單" })).toHaveAttribute("href", CHECKLIST);
  await page.getByRole("button", { name: "上一步：使用空間" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "床畫得下，走動、開門和用櫃子呢？" })).toBeFocused();
  await expect(page.getByRole("link", { name: "回到完整格局", exact: true })).toHaveAttribute("href", "/layouts/3b2l_standard");
  await page.getByRole("button", { name: "上一步：尺寸依據" }).click();
  await page.getByRole("button", { name: "上一步：家具示意" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "畫有床，還不能判斷你的床放得下" })).toBeFocused();
});

test("清單可直接開啟，與第四步顯示相同的完整問題及理由", async ({ page }) => {
  await page.goto(CHECKLIST);
  const items = page.getByRole("list", { name: "向建商追問" }).getByRole("listitem");
  await expect(items).toHaveCount(4);
  for (const item of await items.all()) {
    await expect(item.getByText("為什麼問")).toBeVisible();
    await expect(item.locator("p")).toHaveCount(2);
  }
  const checklistText = await items.allTextContents();
  await page.getByRole("link", { name: "返回導讀" }).click();
  for (const topic of ["尺寸依據", "使用空間", "怎麼追問"]) {
    await page.getByRole("button", { name: `下一步：${topic}` }).click();
  }
  const guideText = await page.getByRole("list", { name: "可帶去詢問的問題" }).getByRole("listitem").allTextContents();
  expect(guideText).toEqual(checklistText);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 812 }, { width: 1280, height: 900 }]) {
  test(`${viewport.width} × ${viewport.height} 清單與第四步可讀，沒有橫向溢出`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(CHECKLIST);
    await expect(page.getByRole("heading", { level: 1, name: "看家具與尺寸時，向建商問這四件事" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.goto(GUIDE);
    for (const topic of ["尺寸依據", "使用空間", "怎麼追問"]) {
      await page.getByRole("button", { name: `下一步：${topic}` }).click();
    }
    await expect(page.getByRole("list", { name: "可帶去詢問的問題" }).getByRole("listitem")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test("列印版只保留標題、適用範圍、四題與理由", async ({ page }) => {
  await page.goto(CHECKLIST);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/本站三房兩廳教學範例/)).toBeVisible();
  await expect(page.getByRole("list", { name: "向建商追問" }).getByRole("listitem")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "列印清單" })).toBeHidden();
  await expect(page.getByRole("link", { name: "返回導讀" })).toBeHidden();
  await expect(page.getByRole("link", { name: /回首頁：拼厝/ })).toBeHidden();
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.length).toBeGreaterThan(1000);
});
