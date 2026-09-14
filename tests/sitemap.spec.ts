import { test, expect } from "@playwright/test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { contentPages } from "./built-html";

// 搜尋引擎抓得到這個網站的全部頁面，不必靠自己爬連結猜（spec user story 32、票 10）。
//
// 兩個問題，期望值都不是手寫的名單：
// - **列了哪些**：從資料算。今天是 1 首頁 + 1 平面圖頁 + 14 符號頁 + 3 分類頁 = 19，但不寫死 19——
//   理由同 category-page.spec.ts 不寫死 3：寫死的話，測試自己就成了第二份會跟資料分岔的名單。
// - **有沒有列錯**：對照 `out/` 裡真的產出了哪些頁。這一條不認得今天有哪些路由，所以明天多一種頁面
//   而 sitemap 忘了它，這裡會紅，而不是安靜地少列一頁（同 site-footer.spec.ts 不列舉路由的理由）。

const SITEMAP = "out/sitemap.xml";

/** 網址上的 layout id：`data/layouts/` 裡每一份 floorplan 自己的 `id`（同 home-page.spec.ts 讀的那一欄）。 */
const layoutIds: string[] = readdirSync("data/layouts")
  .filter((name) => name.endsWith(".floorplan.json"))
  .map((name) => JSON.parse(readFileSync(`data/layouts/${name}`, "utf8")).id);

const symbols: { id: string; category: string }[] = JSON.parse(
  readFileSync("data/symbols.sample.json", "utf8"),
).symbols;

/** 資料裡實際出現過的分類——同 category-page.spec.ts，不寫死 3。 */
const categoriesInData = [...new Set(symbols.map((s) => s.category))];

/** 一份 sitemap 上的每一個 `<loc>`，照出現的先後。 */
const locsOf = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);

/** 建置產物裡那一份 sitemap 列的每一個網址。 */
const builtLocs = () => locsOf(readFileSync(SITEMAP, "utf8"));

/** sitemap 上是絕對網址（協定要求），站內的頁面比的是路徑。 */
const pathOf = (loc: string) => new URL(loc).pathname;

/** 建置產物的檔名 → 它的網址路徑：`index.html` 是 `/`，`symbols/wall.html` 是 `/symbols/wall`。 */
const pagePathOf = (file: string) => (file === "index.html" ? "/" : `/${file.slice(0, -".html".length)}`);

test.describe("sitemap", () => {
  test("build 產物裡有 sitemap，列的剛好是資料算得出來的每一頁", () => {
    expect(existsSync(SITEMAP), "out/ 裡沒有 sitemap.xml").toBe(true);

    const expected = [
      "/",
      ...layoutIds.map((id) => `/layouts/${id}`),
      ...symbols.map((symbol) => `/symbols/${symbol.id}`),
      ...categoriesInData.map((category) => `/categories/${category}`),
    ];
    const listed = builtLocs().map(pathOf);

    // 點名最容易漏的那一頁：平面圖頁是產品本體、轉換點的落地處，spec Testing Decisions 第 19 條點名要它。
    expect(listed, "平面圖頁沒有列在 sitemap 上").toContain("/layouts/3b2l_standard");
    // 比整串而不是數個數：數目對得上、列成別的網址也一樣是壞的。排序後整串比，同一頁列兩次也擋得到。
    expect([...listed].sort()).toEqual([...expected].sort());
  });

  // sitemaps.org 的協定要 `<loc>` 是帶協定的完整網址，只寫 `/symbols/wall` 的 sitemap 搜尋引擎不收；
  // 而一份 sitemap 只能列它自己那個網站底下的網址。
  test("每一個網址都是絕對網址，而且都在同一個網站底下", () => {
    const locs = builtLocs();
    // 零筆時底下的迴圈會安靜地全過。
    expect(locs.length).toBeGreaterThan(0);

    for (const loc of locs) expect(loc).toMatch(/^https?:\/\/[^/]/);
    expect(new Set(locs.map((loc) => new URL(loc).origin)).size).toBe(1);
  });

  // 票面點名的 `plumbing_electric` 這種沒有符號的分類不必另外點名：它沒有頁面，列在 sitemap 上的話
  // 這裡兩邊就不相等。
  test("列的每一頁都真的產出了，產出的每一頁都列在上面", () => {
    const built = contentPages().map(pagePathOf);

    // 掃到零頁、sitemap 也是空的時候，兩邊照樣相等——先確認真的有東西可比（同 home-page.spec.ts）。
    expect(built).toContain(`/layouts/${layoutIds[0]}`);
    expect([...builtLocs().map(pathOf)].sort()).toEqual([...built].sort());
  });

  // 測的是本機預覽的伺服器送出來的那一份，不是 `out/` 裡的檔案：MIME 表漏了 `.xml` 的話，檔案照樣在、
  // 上面三條照樣綠，而瀏覽器把 sitemap 當成 `application/octet-stream` 下載下來（票 10「注意」）。
  test("本機預覽送出的 sitemap 是 XML，上面的每一個網址都打得開", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^application\/xml/);

    // 路徑拿到本機伺服器上打：sitemap 列的是正式站的網址，本機只問「這個路徑有沒有這一頁」。
    // 404 頁也是一張 HTML，所以比的是狀態碼，不是有沒有拿到內容。
    const paths = locsOf(await response.text()).map(pathOf);
    // 零筆時底下的迴圈會安靜地全過。
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });
});
