import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";

// 分類頁是給「想一類一類看完」的人走的那條路（spec user story 24）：打開三張頁，
// 各自看到該分類底下有哪些符號，點任一個進到它的符號頁。
//
// 這一組測試的重心是**清單從哪裡來**。分類頁最容易壞的方式不是版面，是有人在某個檔案裡
// 手寫一份「就這 3 類」的名單——那份名單當天是對的，而它跟資料分岔的那一天畫面上看不出來
// （PRD §9「不得各自維護副本」）。所以「有哪幾頁、每頁列哪些符號」的期望值都是**這個檔案
// 自己從資料算出來的**。唯一抄下三個分類的地方是測中文名的那一條，而那是刻意的——理由寫在那裡。
//
// 與 symbol-page.spec.ts 同一個手法：問「內容在不在 HTML 裡」的讀 `out/` 的建置產物，
// 只有量尺寸與點連結才進瀏覽器（spec user story 33）。

type RawSymbol = {
  id: string;
  name: string;
  category: string;
  plain_meaning: string;
};

const symbols: RawSymbol[] = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")).symbols;

/**
 * 資料裡實際出現過的分類，照資料檔的先後。**今天是 3 類**（spec 的「分類頁剛好 3 張」），
 * 但「有哪幾頁」「每頁列哪些」的斷言都拿這個比，不寫死 3——寫死的話，測試自己就成了
 * 第二份會跟資料分岔的名單。
 */
const categoriesInData = [...new Set(symbols.map((s) => s.category))];

/** 一類底下有哪些符號，照資料檔的先後——頁面上的順序也該是這個。 */
const symbolsIn = (category: string) => symbols.filter((s) => s.category === category);

const built = (id: string) => readFileSync(`out/categories/${id}.html`, "utf8");

/** 把一頁建置產物還原成純文字：問的是讀者看到什麼，不是 HTML 長什麼樣。 */
function textOf(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const titleOf = (html: string) => /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1];
const descriptionOf = (html: string) =>
  /<meta name="description" content="([^"]*)"/.exec(html)?.[1];

/** 這一頁列出了哪些符號——照出現的先後，一個連結一個。 */
const listedSymbols = (id: string) =>
  [...built(id).matchAll(/href="\/symbols\/([^"]+)"/g)].map((m) => m[1]);

test.describe("/categories/[id] 分類頁", () => {
  // v0.4 把設備類砍出範圍，但驗證器的合法分類一直留著它們。留著的後果不是多兩行常數，
  // 而是「這一類階段一尚未收錄」那種空頁面——對讀者沒有價值，Google 當 thin content。
  test("站上有哪些分類由資料算出，沒有符號的分類不產生頁面", () => {
    const fromBuild = readdirSync("out/categories")
      .filter((name) => name.endsWith(".html"))
      .map((name) => name.replace(".html", ""))
      .sort();

    expect(fromBuild).toEqual([...categoriesInData].sort());

    // 點名這兩個：它們是 v0.4 砍出範圍的設備類，而驗證器曾經把它們當合法值。
    for (const cut of ["plumbing_electric", "fire_safety"]) {
      expect(fromBuild, `${cut} 不該有頁面`).not.toContain(cut);
    }
  });

  test("每一類都打得開；資料裡沒有的分類沒有頁面", async ({ page }) => {
    for (const category of categoriesInData) {
      const response = await page.goto(`/categories/${category}`);
      expect(response?.status(), category).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }

    for (const missing of ["plumbing_electric", "fire_safety", "nonexistent_category"]) {
      const response = await page.goto(`/categories/${missing}`);
      expect(response?.status(), missing).toBe(404);
    }
  });

  // 「列出的符號數與資料一致」不能只數個數：數目對得上、列到別類的符號也一樣是壞的。
  // 所以比的是整串 id 與順序。
  test("每一頁列出的就是該分類底下那幾個符號，一個不多一個不少", () => {
    for (const category of categoriesInData) {
      expect(listedSymbols(category), category).toEqual(symbolsIn(category).map((s) => s.id));
    }

    // 14 個符號各自被列到一次，而且只有一次——某一類漏了一個的話，上面那一圈會紅，
    // 但兩類都列了同一個符號的話不會，所以這裡把三頁合起來再數一次。
    const listedEverywhere = categoriesInData.flatMap(listedSymbols).sort();
    expect(listedEverywhere).toEqual(symbols.map((s) => s.id).sort());
  });

  // 分類頁與符號頁的字都來自同一份資料：內容維護者改一次，兩邊一起改（spec user story 34）。
  test("每一列的名字與白話意思都與資料一字不差", () => {
    for (const category of categoriesInData) {
      const text = textOf(built(category));
      for (const symbol of symbolsIn(category)) {
        expect(text, `${category} 少了 ${symbol.id} 的名字`).toContain(symbol.name);
        expect(text, `${category} 少了 ${symbol.id} 的白話意思`).toContain(symbol.plain_meaning);
      }
    }
  });

  // 中文名是介面文案不是內容（資料裡的 category 只有 enum），它在 lib/ui/copy.ts。
  // 這裡刻意**再打一次**那三個中文名：從常數 import 進來的測試只能證明頁面與常數一致，
  // 證不出常數本身被改壞了——而「結構」變成「結構類」是這一頁最沉默的一種壞法。
  // 資料多一類的那一天，這條會先紅、說前提不成立：新的分類帶著新的文案，而文案要有人
  // 釘住（同 symbol-page.spec.ts 的 TIER_COPY）。有哪幾頁、每頁列哪些，則不必動這個檔案。
  test("讀者看到的是中文分類名，不是資料裡的 enum", () => {
    const EXPECTED_ZH: Record<string, string> = {
      structure: "結構",
      door_window: "門窗",
      furniture: "家具家配",
    };

    for (const category of categoriesInData) {
      const zh = EXPECTED_ZH[category];
      expect(zh, `${category} 沒有預期的中文名，這個測試的前提已經不成立`).toBeTruthy();
      expect(titleOf(built(category)), category).toContain(zh);
      // enum 值只該出現在網址與 RSC payload 裡，不該出現在讀者讀得到的字裡面。
      expect(textOf(built(category)), category).not.toContain(category);
    }
  });

  // 三張分類頁共用一句描述、或共用根版面那句「平面圖教學」的話，搜尋引擎會把它們
  // 當成同一頁（spec user story 31）。
  test("每頁有自己的標題與 meta description，而且說得出這一類有哪些符號", () => {
    const titles = categoriesInData.map((c) => titleOf(built(c)));
    const descriptions = categoriesInData.map((c) => descriptionOf(built(c)));

    expect(new Set(titles).size).toBe(categoriesInData.length);
    expect(titles).not.toContain("平面圖教學");
    expect(new Set(descriptions).size).toBe(categoriesInData.length);

    for (const [i, category] of categoriesInData.entries()) {
      expect(descriptions[i], category).toBeTruthy();
      // 描述裡數得出這一類有哪些符號：M1 哪天加一個，這一行自己跟著長。
      for (const symbol of symbolsIn(category)) {
        expect(descriptions[i], `${category} 的描述少了 ${symbol.id}`).toContain(symbol.name);
      }
    }

    // 也不該與符號頁的標題撞名——那 17 頁在搜尋結果上要是 17 條。
    const symbolTitles = symbols.map((s) => titleOf(readFileSync(`out/symbols/${s.id}.html`, "utf8")));
    expect(new Set([...titles, ...symbolTitles]).size).toBe(titles.length + symbolTitles.length);
  });

  test("每一列都連得到那個符號自己的頁面", async ({ page }) => {
    const category = categoriesInData[0];
    const first = symbolsIn(category)[0];
    await page.goto(`/categories/${category}`);

    for (const symbol of symbolsIn(category)) {
      await expect(page.locator(`a[href="/symbols/${symbol.id}"]`)).toBeVisible();
    }

    await page.locator(`a[href="/symbols/${first.id}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(first.name);
  });

  // 三頁都量：符號數最多的那一類最容易撐破版面，而每一列是「圖形 + 名字 + 白話意思」
  // 這種橫排，375px 上它是這一頁唯一會溢出的東西。
  test("在 375px 手機寬度下不溢出、不橫向捲動", async ({ page }) => {
    for (const category of categoriesInData) {
      await page.goto(`/categories/${category}`);
      // 先確認站在分類頁上：404 頁也不會溢出，那樣這條就成了一個永遠是綠的斷言。
      await expect(page.locator(`a[href="/symbols/${symbolsIn(category)[0].id}"]`)).toBeVisible();

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows, category).toBe(false);
    }
  });
});
