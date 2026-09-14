import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import type { SymbolCategory } from "@/lib/symbols/types";
import { CATEGORY_LABELS } from "@/lib/ui/copy";
import { contentPages, descriptionOf, rootLayoutFallback, titleOf } from "./built-html";

// 首頁是「首頁 → 平面圖」那條入站路徑的起點（PRD §8）。它不是主要入口——大多數人從 Google 直接
// 落在符號頁（§6.2.1）——但它是唯一一條產品敘事的路，而根網址回 404 的網站拿不出手。
//
// 與其他頁面的測試同一個規矩：**期望值從資料算**。進平面圖的按鈕有幾個、連去哪、叫什麼，
// 由 `data/layouts/` 裡的 floorplan 決定；分類入口有哪幾個，由 `data/symbols.sample.json` 決定。
// 唯一點名的 id 是 `3b2l_standard`——spec Testing Decisions 第 1 條點名要它，而它今天是唯一一張圖。

/** 每一張 floorplan 的 id（也就是網址上的 layout id）與名字。 */
const floorplans: { id: string; name: string }[] = readdirSync("data/layouts")
  .filter((name) => name.endsWith(".floorplan.json"))
  .map((name) => JSON.parse(readFileSync(`data/layouts/${name}`, "utf8")));

/** spec 點名的那一張。 */
const specNamedFloorplan = floorplans.find((floorplan) => floorplan.id === "3b2l_standard");

const symbols: { id: string; category: string }[] = JSON.parse(
  readFileSync("data/symbols.sample.json", "utf8"),
).symbols;

/** 資料裡實際出現過的分類，照資料檔的先後——同 category-page.spec.ts，不寫死 3。 */
const categoriesInData = [...new Set(symbols.map((s) => s.category))];

test.describe("/ 首頁", () => {
  test("根網址打得開：一句主張，一個按鈕直接進平面圖", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // 主張**再打一次** PRD §8 的原句、不從常數拿：從常數 import 的斷言證不出常數本身被改壞
    // （同 site-footer.spec.ts 的免責、category-page.spec.ts 的中文分類名）。只問「有一個 h1」的話，
    // 換成任何一句標題都會過。
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("一張平面圖，你真的看得懂嗎？");

    // 前提：spec 點名的那張圖還在資料裡。哪天它被改名，這條要帶著訊息紅，而不是安靜地少測一張。
    expect(specNamedFloorplan, "spec 點名的 3b2l_standard 不在 data/layouts 裡").toBeTruthy();
    const target = specNamedFloorplan!;

    // 按鈕的字帶著格局的名字：讀者按下去之前就知道會到哪張圖（PRD §8「開始探索三房兩廳」）。
    for (const floorplan of floorplans) {
      const button = page.locator(`main a[href="/layouts/${floorplan.id}"]`);
      await expect(button, `沒有進 ${floorplan.id} 的按鈕`).toBeVisible();
      await expect(button).toContainText(floorplan.name);
    }

    await page.locator(`main a[href="/layouts/${target.id}"]`).click();
    await expect(page).toHaveURL(`/layouts/${target.id}`);
    await expect(page.getByRole("group", { name: target.name })).toBeVisible();
  });

  // 搜尋框與分類頁上那個是**同一個元件**（票 07「不是第二份實作」）：比對規則、注音、鍵盤、
  // 找不到時的回饋，search-box.spec.ts 已經在分類頁上測過，這裡不重測一遍。
  // 這裡只問首頁上它在不在、打字之後是不是當場出結果（spec Testing Decisions 第 13 條）。
  // 點名樑的理由同 search-box.spec.ts：票 06 與 CONTEXT.md「樑」都說「暗樑」屬於它。
  test("搜尋框打字，結果當場出現：不換頁、不打網路", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    const search = page.getByRole("search");
    await search.getByRole("searchbox").pressSequentially("暗樑");

    await expect(search.locator('a[href="/symbols/beam"]')).toBeVisible();
    await expect(search.getByRole("status")).toContainText("找到");
    await expect(page).toHaveURL("/");
    expect(requests, "打字的時候不該有任何網路請求").toEqual([]);
  });

  // 想一類一類看完的人從這裡走。分類頁在票 05 落地時沒有任何一頁連到它們，入口就是這裡。
  // 比的是整串網址與先後，不只數個數：數目對得上、連到不存在的分類也一樣是壞的。
  test("分類入口：資料裡有幾類就有幾個，各自連得到那一類的分類頁", async ({ page }) => {
    await page.goto("/");

    const entries = page.locator('main a[href^="/categories/"]');
    const hrefs = await entries.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(hrefs).toEqual(categoriesInData.map((category) => `/categories/${category}`));

    // 中文名從常數拿：中文名本身有沒有被改壞，category-page.spec.ts 的 `EXPECTED_ZH` 已經釘住，
    // 這一條只證「入口用的是那份中文名」（同 search-box.spec.ts 的結果列）。
    for (const category of categoriesInData) {
      await expect(page.locator(`main a[href="/categories/${category}"]`)).toContainText(
        CATEGORY_LABELS[category as SymbolCategory].zh,
      );
    }

    const first = categoriesInData[0];
    await page.locator(`main a[href="/categories/${first}"]`).click();
    await expect(page).toHaveURL(`/categories/${first}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  // 首頁與平面圖頁的標題是對照著取的（票 07）。但「與平面圖頁不同」只是最低要求：
  // 與站上**任何一頁**同名，搜尋結果上都是兩條分不開的連結。所以掃過 `out/` 裡每一張有自己內容的頁，
  // 不列舉路由——理由同 site-footer.spec.ts：列舉的清單明天多一頁時不會紅，只會少測一頁。
  test("首頁有自己的標題與 meta description，與站上其他每一頁都不同", () => {
    const home = readFileSync("out/index.html", "utf8");
    const fallback = rootLayoutFallback();

    expect(titleOf(home)).toBeTruthy();
    expect(descriptionOf(home)).toBeTruthy();
    expect(fallback.titles, "首頁用的還是根版面的標題").not.toContain(titleOf(home));
    expect(descriptionOf(home), "首頁用的還是根版面的描述").not.toBe(fallback.description);

    // 404 與 `_not-found` 是根版面的後備頁，本來就沒有自己的標題，`contentPages()` 不含它們。
    const others = contentPages().filter((path) => path !== "index.html");
    // 票面點名的那一頁要在掃描範圍裡：掃到零頁時底下的迴圈會安靜地全過。
    expect(others).toContain(`layouts/${floorplans[0].id}.html`);

    for (const path of others) {
      const html = readFileSync(`out/${path}`, "utf8");
      expect(titleOf(html), `${path} 與首頁同名`).not.toBe(titleOf(home));
      expect(descriptionOf(html), `${path} 與首頁的描述相同`).not.toBe(descriptionOf(home));
    }
  });

  // 375px 上會撐破版面的是最長的那幾樣：按鈕上的格局名、分類入口的英文小字，以及搜尋結果——
  // 最後一樣 search-box.spec.ts 在分類頁上量過，同一個元件，這裡只量首頁自己的東西。
  test("375px 下不溢出：主張、按鈕、分類入口都擠得進去", async ({ page }) => {
    await page.goto("/");
    // 先確認站在首頁上：404 頁也不會溢出，那樣這條就成了一個永遠是綠的斷言。
    await expect(page.locator(`main a[href="/layouts/${floorplans[0].id}"]`)).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);
  });

  // 票面「要小」：不做示意圖、統計數字、動畫。示意圖是其中唯一量得出來的一樣——
  // 首頁的內容區裡沒有任何一張圖。符號圖形與平面圖各有自己的頁，首頁是往那裡走的入口，不是它們的縮圖。
  test("沒有示意圖：首頁的內容區裡沒有任何一張圖", async ({ page }) => {
    await page.goto("/");
    // 先確認站在首頁上，而且用首頁才有的東西確認：404 頁也有 `<h1>`、也沒有圖。
    await expect(page.locator(`main a[href="/layouts/${floorplans[0].id}"]`)).toBeVisible();

    await expect(page.locator("main").locator("img, svg, picture, video, canvas, figure")).toHaveCount(0);
  });
});
