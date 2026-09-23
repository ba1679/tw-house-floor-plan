import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { SymbolCategory } from "@/lib/symbols/types";
import { CATEGORY_LABELS } from "@/lib/ui/copy";

// 搜尋框是給「想查特定符號的人」的（spec user story 20–23）：打幾個字，結果當場出現，
// 不必在三張分類頁裡翻。
//
// 打的字對得到哪些符號，是 `tests/search-matching.spec.ts` 的事（seam ③，組合性的風險在那裡掃）。
// 這一組只問**頁面上**發生了什麼（seam ①）：框在不在、打字之後結果有沒有當場出現、
// 有沒有換頁或打網路、找不到時有沒有回饋、鍵盤走不走得完——比對規則在這裡只抽一兩個樣本。
//
// **期望值從資料檔算，不寫死會列出哪幾個、列出幾個**：M1 與 M3 並行、動的正是資料檔，理由寫在
// search-matching.spec.ts 開頭。唯一點名的符號是樑——票面與 CONTEXT.md「樑」都說「暗樑」屬於它。
// 找結果列一律用 `href` 找，不用連結名字：名字與別名會隨資料變，網址是符號的 id。

type RawSymbol = {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  plain_meaning: string;
};

const symbols: RawSymbol[] = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")).symbols;
const categoriesInData = [...new Set(symbols.map((s) => s.category))];
const beam = symbols.find((s) => s.id === "beam")!;

test.describe("搜尋框", () => {
  // 「當場」有三個意思，三個都要成立：不換頁、不 fetch、不需要按送出。
  // 索引在 build 時就內嵌進頁面了，打字這件事不該碰到網路——在接待中心的行動網路上，
  // 每打一個字等一次回應，它就不像個工具而像個網頁（spec user story 23）。
  test("分類頁上打字，結果當場出現：不換頁、不打網路、不必按送出", async ({ page }) => {
    const category = categoriesInData[0];
    await page.goto(`/categories/${category}`);
    await page.waitForLoadState("networkidle");

    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    const search = page.getByRole("search");
    await search.getByRole("searchbox").pressSequentially("暗樑");

    // 結果只在搜尋區裡找：結構那一頁本來就列著樑，整頁找的話這條什麼都證明不了。
    await expect(search.locator(`a[href="/symbols/${beam.id}?from=search"]`)).toBeVisible();
    await expect(page).toHaveURL(`/categories/${category}`);
    expect(requests, "打字的時候不該有任何網路請求").toEqual([]);
  });

  // 沒有命中時一片空白，讀者分不出是「沒有這個符號」還是「搜尋壞了、還在等」。
  // 回饋放在狀態列（role="status"）：看得見的人讀得到，讀螢幕的人不必把焦點移開輸入框也聽得到。
  test("打字之後說得出結果：找到幾個，或找不到；還沒打字時什麼都不說", async ({ page }) => {
    await page.goto(`/categories/${categoriesInData[0]}`);
    const search = page.getByRole("search");
    const box = search.getByRole("searchbox");
    const status = search.getByRole("status");

    // 還沒打字就說「找不到」，等於在讀者開口之前先回絕他。
    await expect(status).toHaveText("");

    await box.pressSequentially("游泳池");
    // 字是**再打一次**的，不從常數拿：從常數 import 的斷言證不出常數本身被改壞（同 category-page.spec.ts）。
    // 把他打的字複述回去，他才看得出是自己打錯了，還是這裡真的沒有。
    await expect(status).toHaveText("找不到符合「游泳池」的符號");
    await expect(search.getByRole("link")).toHaveCount(0);

    // 有命中時說幾個，而且要與列出來的一樣多。先等狀態列換上這一次的結果再數——
    // 數在畫面更新之前的話，數到的是上一次的零個。
    await box.fill("門");
    await expect(status).toContainText("找到");
    const listed = await search.getByRole("link").count();
    expect(listed).toBeGreaterThan(0);
    await expect(status).toHaveText(`找到 ${listed} 個符號`);
  });

  // 打的是別名時，那一列要看得出為什麼是它（`searchAliasHint`）。挑一個帶大寫英數字的別名、打小寫：
  // 同時問得到「印的是資料裡的原文，不是正規化之後的樣子」。
  test("結果列說得出它是什麼：名字、哪一類，以及只有別名對上時是哪一個別名", async ({ page }) => {
    const pick = symbols
      .flatMap((symbol) => symbol.aliases.map((alias) => ({ symbol, alias })))
      .find(
        ({ symbol, alias }) =>
          /[A-Z]/.test(alias) && !symbol.name.toLowerCase().includes(alias.toLowerCase()),
      );
    expect(pick, "資料裡沒有帶大寫英數字的別名了，這條測試的前提不成立，換一種挑法").toBeTruthy();
    const { symbol, alias } = pick!;

    await page.goto(`/categories/${categoriesInData[0]}`);
    const search = page.getByRole("search");
    const box = search.getByRole("searchbox");
    const row = search.locator(`a[href="/symbols/${symbol.id}?from=search"]`);

    await box.pressSequentially(alias.toLowerCase());
    await expect(row).toContainText(symbol.name);
    await expect(row).toContainText(alias);
    // 分類名**從常數拿**，與 category-page.spec.ts 的 `EXPECTED_ZH` 刻意不同：那一條要證的是中文名本身
    // 沒被改壞，已經釘住了；這一條要證的只是「這一列用的是那份中文名」，再打一次只是多一份要同步的抄本。
    await expect(row).toContainText(CATEGORY_LABELS[symbol.category as SymbolCategory].zh);

    // 名字本身就對上時不另外說。名字裡本來就含有的別名（「管道間」裡的「管道」）不算：那幾個字本來就在名字上。
    await box.fill(symbol.name);
    await expect(row).toBeVisible();
    for (const other of symbol.aliases.filter((a) => !symbol.name.includes(a))) {
      await expect(row).not.toContainText(other);
    }
  });

  // 受眾是台灣人（PRD §3），打中文多半用注音。組字的時候，輸入框裡暫時是「ㄢˋ」這種還沒選字的注音——
  // 那時候就去比對，狀態列會說「找不到符合『ㄢˋ』的符號」，等於**每一次搜尋的第一個鍵都被回絕一次**。
  test("注音組字到一半不算打完：不說找不到，選完字才出結果", async ({ page }) => {
    await page.goto(`/categories/${categoriesInData[0]}`);
    const search = page.getByRole("search");
    const box = search.getByRole("searchbox");
    const status = search.getByRole("status");
    await box.focus();

    // Playwright 沒有組字的 API，所以走 Chromium 的 DevTools Protocol。它送出的事件序列與真的輸入法
    // 相同：組字中的每一次 `input` 都帶著 `isComposing`，選完字最後才來 `compositionend`。
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.imeSetComposition", { text: "ㄢˋ", selectionStart: 2, selectionEnd: 2 });
    await expect(box).toHaveValue("ㄢˋ");
    // 「不說找不到」是一個否定句，要先等畫面有機會更新過再問，否則它在更新之前就先綠了。
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await expect(status).toHaveText("");
    await expect(search.getByRole("link")).toHaveCount(0);

    await cdp.send("Input.insertText", { text: "暗樑" });
    await expect(box).toHaveValue("暗樑");
    await expect(search.locator(`a[href="/symbols/${beam.id}?from=search"]`)).toBeVisible();
    await expect(status).not.toContainText("找不到");
  });

  // 從別的分類頁搜，才證得出這一條連結是搜尋給的，而不是那一頁本來就列著的。
  test("點一筆結果，到得了那個符號自己的頁面", async ({ page }) => {
    const elsewhere = categoriesInData.find((c) => c !== beam.category)!;
    await page.goto(`/categories/${elsewhere}`);

    const search = page.getByRole("search");
    await search.getByRole("searchbox").pressSequentially("暗樑");
    await search.locator(`a[href="/symbols/${beam.id}?from=search"]`).click();

    await expect(page).toHaveURL(`/symbols/${beam.id}?from=search`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(beam.name);
  });

  // 不需要滑鼠也能用（spec user story 29）。結果排在輸入框的正後方，所以打完字按 Tab 就走進結果——
  // 不必另外搬焦點，也不需要方向鍵那一套 combobox。
  test("鍵盤走得完：Tab 進得了搜尋框，打完字之後 Tab 依序走過每一筆結果", async ({ page }) => {
    await page.goto(`/categories/${categoriesInData[0]}`);
    const search = page.getByRole("search");
    const box = search.getByRole("searchbox");

    // M6 的全站 header 是頁面的第一個鍵盤入口；下一格才是內容區的搜尋框。
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /回首頁/ })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(box).toBeFocused();

    await page.keyboard.type("門");
    const results = search.getByRole("link");
    await expect(results.first()).toBeVisible();
    const hrefs = await results.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    // 至少兩筆，「依序走過」才有東西可比。
    expect(hrefs.length).toBeGreaterThan(1);

    for (const href of hrefs) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(href);
    }
  });

  // 索引在 build 時就內嵌進頁面，而且**只有四欄**（id、name、aliases、category）。
  // 讀建置產物本身來問：要驗的正是「靜態檔案裡帶了什麼出去」，同 symbol-page.spec.ts 問平面圖頁的那一條。
  test("內嵌的索引帶著全部符號的別名，而且沒有夾帶其他欄位", () => {
    for (const category of categoriesInData) {
      const html = readFileSync(`out/categories/${category}.html`, "utf8");

      // 全部符號的別名都在：索引是整份內嵌，不是只有這一類，也不是打字時才去抓。
      for (const symbol of symbols) {
        for (const alias of symbol.aliases) {
          expect(html, `${category} 頁少了 ${symbol.id} 的別名「${alias}」`).toContain(alias);
        }
      }

      for (const field of [
        "verification_status",
        "verified_at",
        "verified_by",
        "source_refs",
        "ai_description",
        "detection_hints",
        "_pilot_note",
        "related_layouts",
        "plain_meaning",
        "confused_with",
        "svg_ref",
      ]) {
        expect(html, `${category} 頁夾帶了 ${field}`).not.toContain(field);
      }

      // 別類的白話意思不在這一頁上。欄位名擋得住整欄夾帶，這一條擋的是「換個名字夾帶」。
      for (const other of symbols.filter((s) => s.category !== category)) {
        expect(html, `${category} 頁夾帶了 ${other.id} 的白話意思`).not.toContain(
          other.plain_meaning,
        );
      }
    }
  });

  // 375px 上撐破版面的是**沒有斷點的字**：讀者打的一長串英數字被狀態列原封不動複述回去，
  // 或是結果列上最長的那個別名。
  test("三張分類頁都有搜尋框；375px 下結果與回饋都不溢出", async ({ page }) => {
    const longestAlias = symbols
      .flatMap((s) => s.aliases)
      .reduce((longest, alias) => (alias.length > longest.length ? alias : longest));

    for (const category of categoriesInData) {
      await page.goto(`/categories/${category}`);
      const search = page.getByRole("search");
      const box = search.getByRole("searchbox");
      await expect(box, category).toBeVisible();

      for (const typed of [longestAlias, "x".repeat(60)]) {
        await box.fill(typed);
        // 先確認狀態列已經換上這一次的結果：還沒更新的畫面也不會溢出。
        await expect(search.getByRole("status")).not.toHaveText("");
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(overflows, `${category}：打「${typed}」`).toBe(false);
      }
    }
  });
});
