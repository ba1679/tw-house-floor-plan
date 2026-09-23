import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { descriptionOf, rootLayoutFallback, titleOf } from "./built-html";

/** data/layouts 裡的 floorplan 資料檔。站上有哪些平面圖頁，由這份清單決定。 */
const floorplanFiles = readdirSync("data/layouts").filter((name) =>
  name.endsWith(".floorplan.json"),
);

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
    const fromData = floorplanFiles.map((name) => name.replace(".floorplan.json", "")).sort();
    const fromBuild = readdirSync("out/layouts")
      .filter((name) => name.endsWith(".html"))
      .map((name) => name.replace(".html", ""))
      .sort();

    expect(fromBuild).toEqual(fromData);
  });

  // 沿用根版面那一句「平面圖教學」的話，這一頁在搜尋結果上與首頁同名（spec「全站」）。
  // 「根版面那一句」從 404 頁讀，不從程式裡抄（`rootLayoutFallback`）。
  //
  // 標題與描述由**那張圖自己的資料**生成（`floorplan.name`），不寫死三房兩廳：M7 加第 2 張圖時不必回頭改。
  // **這條擋不住寫死**：今天資料只有一張圖，把「三房兩廳平面圖怎麼看？」原封不動寫進程式也會過。
  // 它擋得住的是「沿用根版面」與「名字對不上資料」；寫死那一道要等第 2 張圖進來才量得出來。
  test("每一張平面圖頁有自己的標題與 meta description，由那張圖的名字生成", () => {
    const fallback = rootLayoutFallback();

    for (const file of floorplanFiles) {
      const floorplan: { id: string; name: string } = JSON.parse(
        readFileSync(`data/layouts/${file}`, "utf8"),
      );
      const html = readFileSync(`out/layouts/${floorplan.id}.html`, "utf8");

      expect(titleOf(html), floorplan.id).toContain(floorplan.name);
      expect(fallback.titles, `${floorplan.id} 用的還是根版面的標題`).not.toContain(titleOf(html));
      expect(descriptionOf(html), floorplan.id).toContain(floorplan.name);
      expect(descriptionOf(html), `${floorplan.id} 用的還是根版面的描述`).not.toBe(
        fallback.description,
      );
    }
  });
});
