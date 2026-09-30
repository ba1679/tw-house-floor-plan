import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { printedSourceRefs } from "@/lib/symbols/source-refs";

// 出處印成什麼樣，這裡用 **fixture** 問——票 03 兩次明講「用 fixture 驗」。
//
// **為什麼非 fixture 不可**：現況 15 筆 `source_refs` 沒有任何一筆有 `url`（缺的那兩筆屬於
// M1），所以「有 url 就連得出去」那條路在真資料上走不到。頁面測試（seam ①）讀的是真資料的
// 建置產物，走不到它；`build-validation` 的 sandbox（seam ②）只跑 `validate_data.py`，也走不到。
// 而 spec 明講不要用「改一筆資料看頁面跟不跟著變」來測，那要重跑 `next build`。
// 三條 seam 都到不了，剩下的只有把那個決定抽成純函式、拿 fixture 餵它。
//
// **這不是 spec 的 seam ③。** ③ 是為搜尋比對開的，spec 還寫明它是「唯一的新 seam」。
// 這裡沿用它的**形式**（純函式、node context、不需要 `page` fixture、不新增框架也不改 config），
// 但破例的理由是票 03 自己的：一條在真資料上不存在、卻會在 M1 補完當天直接上線的路徑。
// spec 那一句因此已經不準，記在票 03 的 Comments 裡。
//
// 純函式只放真資料到不了的案例。下方的頁面測試守住重新編排後的出處順序與清單語意；
// 各欄文字是否齊全仍由 `tests/symbol-page.spec.ts` 的建置產物測試顧著。

const guild = "室內設計裝修製圖規範（中華民國室內設計裝修商業同業公會全國聯合會）";

test("符號頁出處保留清單語意與資料順序，沒有連結的來源也佔一列", async ({ page }) => {
  const { symbols } = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")) as {
    symbols: { id: string; source_refs: { doc: string; url?: string }[] }[];
  };
  expect(symbols.length).toBeGreaterThan(0);
  for (const symbol of symbols) {
    await page.goto(`/symbols/${symbol.id}`);
    const sources = page.locator('section[data-section="sources"]');
    const items = sources.getByRole("list").getByRole("listitem");
    await expect(items).toHaveCount(symbol.source_refs.length);
    for (const [index, ref] of symbol.source_refs.entries()) {
      const item = items.nth(index);
      await expect(item.locator("p").first()).toHaveText(ref.doc);
      if (ref.url) {
        await expect(item.getByRole("link")).toHaveAttribute("href", ref.url);
      } else {
        await expect(item.getByRole("link")).toHaveCount(0);
      }
    }
  }
});

test.describe("一筆 source_ref 印成什麼", () => {
  // 缺 url 就少印一筆，等於讓「沒附連結的來源」在頁面上消失——
  // 讀者數得出來的來源數會比我們實際查到的少，那比沒有連結嚴重得多。
  test("有 url 的連得出去，沒有的印純文字——兩者都算一筆", () => {
    const entries = printedSourceRefs([
      { doc: "地籍測量實施規則", clause: "第 273 條", url: "https://law.moj.gov.tw/x" },
      { doc: guild, clause: "p28-29 表 12" },
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0].link?.href).toBe("https://law.moj.gov.tw/x");
    expect(entries[1].link).toBeNull();
    // 沒有連結的那一筆，該印的字一個都沒少。
    expect(entries[1].doc).toBe(guild);
    expect(entries[1].locator).toBe("p28-29 表 12");
  });

  // 同一頁上可能有兩個連結（雨遮就是），都叫「看原文」的話，
  // 讀螢幕的人聽到的是兩個一模一樣的連結，分不出哪個通往哪裡。
  test("連結的字帶著文件名，兩個連結分得出誰是誰", () => {
    const entries = printedSourceRefs([
      { doc: "地籍測量實施規則", url: "https://law.moj.gov.tw/a" },
      { doc: "建築技術規則建築設計施工編", url: "https://law.moj.gov.tw/b" },
    ]);

    expect(entries[0].link?.label).toContain("地籍測量實施規則");
    expect(entries[1].link?.label).toContain("建築技術規則建築設計施工編");
    expect(entries[0].link?.label).not.toBe(entries[1].link?.label);
  });

  // 內容維護者補第 2 個交叉來源之後，頁面自己多一行（spec user story 36）。
  test("補幾筆就是幾筆，元件不必回頭改", () => {
    const one = printedSourceRefs([{ doc: guild, clause: "p18 表 6" }]);
    const three = printedSourceRefs([
      { doc: guild, clause: "p18 表 6" },
      { doc: "公共工程製圖手冊", clause: "第 3 章" },
      { doc: "CNS 11567 建築製圖（類號 A1042）", clause: "表 6", year: 2012 },
    ]);

    expect(one).toHaveLength(1);
    expect(three).toHaveLength(3);
    expect(three.map((e) => e.doc)).toEqual([guild, "公共工程製圖手冊", "CNS 11567 建築製圖（類號 A1042）"]);
  });

  // clause 是定位資訊（頁碼、表號），year 是版本年——兩者是同一件事的兩半：
  // 「去哪一份的哪一頁看」。併成一行，讀者掃一眼就知道要翻到哪。
  test("條次與年份併成一行，缺的那一半不留痕跡", () => {
    const [both, onlyClause, onlyYear, neither] = printedSourceRefs([
      { doc: "地籍測量實施規則", clause: "106 年修正刪除雨遮測量登記規定", year: 2017 },
      { doc: guild, clause: "p47 表 24" },
      { doc: "某份只知道年份的文件", year: 2020 },
      { doc: "某份什麼都沒填的文件" },
    ]);

    expect(both.locator).toBe("106 年修正刪除雨遮測量登記規定 · 2017");
    expect(onlyClause.locator).toBe("p47 表 24");
    expect(onlyYear.locator).toBe("2020");
    // 兩者都沒有就是 null，不是空字串——空字串會在頁面上留一條看不見的空行。
    expect(neither.locator).toBeNull();
  });
});
