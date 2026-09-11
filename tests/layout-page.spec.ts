import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";

// 這一組測的是曳光彈本身：資料檔 → 建置驗證 → 路由 → 渲染 → 真的在瀏覽器裡量得出尺寸。
test.describe("/layouts/[id] 靜態平面圖", () => {
  test("打開三房兩廳的網址就看到平面圖，而且量得出非零尺寸", async ({ page }) => {
    await page.goto("/layouts/3b2l_standard");

    const plan = page.getByRole("group", { name: /三房兩廳/ });
    await expect(plan).toBeVisible();

    const box = await plan.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test("圖是 inline 的向量圖，房間與牆各自定址得到", async ({ page }) => {
    await page.goto("/layouts/3b2l_standard");

    // 熱區層（02）要跟圖面在同一個座標系底下，所以圖必須是 inline SVG 而不是一張 <img>。
    // 圖是檢視器自己從 floorplan 資料畫的（票 07），畫法本身另有一組測試：
    // tests/floorplan-renderer.spec.ts。
    await expect(page.locator("svg#floorplan-3b2l_standard")).toBeAttached();
    await expect(page.locator("#room-master")).toBeAttached();
    await expect(page.locator("#wall-001")).toBeAttached();
  });

  test("在 375px 手機寬度下不溢出、不橫向捲動", async ({ page }) => {
    await page.goto("/layouts/3b2l_standard");

    const plan = page.getByRole("group", { name: /三房兩廳/ });
    const box = await plan.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(375);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  test("網址以 layout id 定址：資料裡沒有的 id 沒有頁面", async ({ page }) => {
    const response = await page.goto("/layouts/nonexistent_layout");
    expect(response?.status()).toBe(404);
  });

  // 第二張格局圖只要放資料檔進來就該有頁面。這條測的就是那件事：
  // build 出來的頁面集合，必須等於 data/layouts 裡的資料檔集合。
  test("站上有哪些格局由資料檔決定，不是寫死在程式裡", () => {
    const fromData = readdirSync("data/layouts")
      .filter((name) => name.endsWith(".floorplan.json"))
      .map((name) => name.replace(".floorplan.json", ""))
      .sort();
    const fromBuild = readdirSync("out/layouts")
      .filter((name) => name.endsWith(".html"))
      .map((name) => name.replace(".html", ""))
      .sort();

    expect(fromBuild).toEqual(fromData);
  });
});
