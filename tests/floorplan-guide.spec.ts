import { expect, test } from "@playwright/test";
import { blockLocalStorage } from "./storage";
import { blankSpot, dragLeft } from "./viewer-page";

const PLAN = "/layouts/3b2l_standard";

test("試點帶進真正的放大流程，再點藍框才開說明", async ({ page }) => {
  await page.goto(PLAN);
  const guide = page.getByRole("region", { name: "平面圖操作提示" });
  await expect(guide.getByText("這張平面圖可以點")).toBeVisible();
  await expect(guide.getByText("點想了解的位置")).toBeVisible();
  await expect(guide.getByText("再點藍框看說明")).toBeVisible();

  await guide.getByRole("button", { name: "試點一個符號" }).click();
  const door = page.locator("#hs-door-entry");
  await expect(door).toHaveAttribute("data-state", "candidate");
  await expect(page.getByRole("button", { name: "關閉說明" })).toHaveCount(0);
  await expect(guide.getByText("放大了，再點藍框看說明")).toBeVisible();

  const box = (await door.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(door).toHaveAttribute("data-state", "selected");
  await expect(page.getByRole("button", { name: "關閉說明" })).toBeVisible();
  await expect(guide).toHaveCount(0);
});

test("回訪與拖動後，操作提示和試點起點仍然存在", async ({ page }) => {
  await page.goto(PLAN);
  await expect(page.locator("#hotspot-layer")).toHaveAttribute("data-hint", /on|off/);
  await page.reload();
  const guide = page.getByRole("region", { name: "平面圖操作提示" });
  await expect(guide).toBeVisible();
  const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
  await dragLeft(page, blankSpot(frame), 20);
  await expect(guide.getByRole("button", { name: "試點一個符號" })).toBeVisible();
  await guide.getByRole("button").click();
  await expect(page.locator("#hs-door-entry")).toHaveAttribute("data-state", "candidate");
});

test("封鎖 localStorage 仍能試點，重選後也能直接點圖", async ({ page }) => {
  await blockLocalStorage(page);
  await page.goto(PLAN);
  await page.getByRole("button", { name: "試點一個符號" }).click();
  await expect(page.locator("#hs-door-entry")).toHaveAttribute("data-state", "candidate");
  await page.getByRole("button", { name: "重選", exact: true }).click();
  const column = page.locator("#hs-col-nw");
  const box = (await column.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(column).toHaveAttribute("data-state", "candidate");
});

test("鍵盤試點後焦點接到候選，Enter 開說明並如實記錄輸入方式", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __fpAnalyticsEvents: unknown[] }).__fpAnalyticsEvents = [];
  });
  await page.goto(PLAN);
  const starter = page.getByRole("button", { name: "試點一個符號" });
  await starter.focus();
  await page.keyboard.press("Enter");
  const door = page.locator("#hs-door-entry");
  await expect(door).toBeFocused();
  await expect(page.getByRole("button", { name: "關閉說明" })).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "關閉說明" })).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { __fpAnalyticsEvents: { action?: string; input_method?: string }[] })
      .__fpAnalyticsEvents.filter((e) => e.action === "candidates_shown" || e.action === "symbol_confirmed")
      .map((e) => ({ action: e.action, input_method: e.input_method })),
  )).toEqual([
    { action: "candidates_shown", input_method: "keyboard" },
    { action: "symbol_confirmed", input_method: "keyboard" },
  ]);
});

test("從符號頁進來，試點接續網址帶進來的符號", async ({ page }) => {
  await page.goto(`${PLAN}?symbol=column`);
  await expect(page.locator("#hs-col-nw")).toHaveAttribute("data-state", "highlighted");
  await page.getByRole("button", { name: "試點一個符號" }).click();
  await expect(page.locator("#hs-col-nw")).toHaveAttribute("data-state", "candidate");
  await expect(page.locator("#hs-col-nw")).toBeFocused();
});

for (const size of [
  { width: 375, height: 812 },
  { width: 320, height: 568 },
  { width: 1280, height: 900 },
]) {
  test(`${size.width} × ${size.height} 操作提示與試點兩段都在一個螢幕內`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(PLAN);
    const guide = page.getByRole("region", { name: "平面圖操作提示" });
    const starter = guide.getByRole("button");
    await expect(guide).toBeInViewport({ ratio: 1 });
    const buttonBox = (await starter.boundingBox())!;
    expect(buttonBox.width).toBeGreaterThanOrEqual(44);
    expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    await starter.click();
    await expect(guide).toBeInViewport({ ratio: 1 });
    const door = page.locator("#hs-door-entry");
    await expect(door).toHaveAttribute("data-state", "candidate");
    await expect(door).toBeInViewport({ ratio: 1 });
    const box = (await door.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("button", { name: "關閉說明" })).toBeVisible();
    await expect(page.locator("#floorplan-viewport")).toBeInViewport({ ratio: 1 });
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
    );
    expect(overflow).toBe(false);
  });
}
