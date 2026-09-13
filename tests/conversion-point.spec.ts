import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { blankSpot, dragLeft, markingOf, painted, pinch } from "./viewer-page";

// 轉換點：符號頁底部那顆按鈕，是把 SEO 流量帶進平面圖的**唯一入口**（PRD §6.2.1，M3 票 08）。
// 從 Google 落在「窗」那一頁的人讀完之後按下去，進到三房兩廳，圖上 9 扇窗同時亮起來——
// 他看得到這個符號在真實的圖上長在哪些地方。
//
// 高亮是**疊在 browsing 上的一層標記，不是第四個階段**（docs/adr/0006）。所以這一組除了
// 「亮了沒」，大半在問 browsing 的行為有沒有被它弄壞：縮放、拖曳、直接點圖開始下一個。

type Hotspot = { id: string; symbol_id: string | null };

const symbols: { id: string; name: string; related_layouts: string[] }[] = JSON.parse(
  readFileSync("data/symbols.sample.json", "utf8"),
).symbols;

const floorplanOf = (layoutId: string): { hotspots: Hotspot[] } =>
  JSON.parse(readFileSync(`data/layouts/${layoutId}.floorplan.json`, "utf8"));

/** 這個符號在那張圖上的熱區 id——從資料數，不寫死 9 / 5 / 5。 */
const hotspotIdsOf = (symbolId: string, layoutId: string) =>
  floorplanOf(layoutId)
    .hotspots.filter((h) => h.symbol_id === symbolId)
    .map((h) => h.id)
    .sort();

const highlightedIds = (page: Page) =>
  page
    .locator('#hotspot-layer [data-state="highlighted"]')
    .evaluateAll((els) => els.map((el) => el.id).sort());

const CONVERSION_BUTTON = /這個符號在真實格局裡長怎樣/;

test.describe("符號頁 → 平面圖：該符號的每一處同時亮起來", () => {
  // 票面點名的三個：窗 9 處、單扇門 5 處、柱 5 處。一處的符號亮起來跟點選沒兩樣，看不出「全部」。
  for (const symbolId of ["window", "door_single_swing", "column"]) {
    const symbol = symbols.find((s) => s.id === symbolId)!;

    test(`${symbol.name}的符號頁按下去，圖上${symbol.name}的每一處都亮了，而且沒有別的東西跟著亮`, async ({
      page,
    }) => {
      // 目標格局取自 related_layouts，不寫死 3b2l_standard（spec「路由」）。
      const [layoutId] = symbol.related_layouts;
      const expected = hotspotIdsOf(symbolId, layoutId);
      expect(expected.length, `${symbolId} 在 ${layoutId} 上不到兩處，看不出是「全部」亮起來`).toBeGreaterThan(1);

      await page.goto(`/symbols/${symbolId}`);
      await page.getByRole("link", { name: CONVERSION_BUTTON }).click();

      await expect(page).toHaveURL(`/layouts/${layoutId}?symbol=${symbolId}`);
      await expect.poll(() => highlightedIds(page)).toEqual(expected);

      // 使用者從符號頁進來時根本沒有點過任何東西：不是候選、不是選中、說明卡也沒有開。
      await expect(page.locator('#hotspot-layer [data-state="candidate"]')).toHaveCount(0);
      await expect(page.locator('#hotspot-layer [data-state="selected"]')).toHaveCount(0);
      await expect(page.locator("#info-sheet")).toBeHidden();

      // 階段維持 browsing、視野維持全圖：沒有「重選」（第二段才有），也沒有「回到全圖」（放大過才有）。
      // 不自動放大——9 扇窗散在全圖，放大只會藏起其中幾處。
      await expect(page.getByRole("button", { name: "重選" })).toBeHidden();
      await expect(page.getByRole("button", { name: "回到全圖" })).toBeHidden();
      const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
      const plan = (await page.locator(`svg#floorplan-${layoutId}`).boundingBox())!;
      expect(plan.width).toBeCloseTo(frame.width, 0);
      expect(plan.x).toBeCloseTo(frame.x, 0);
    });
  }
});

test.describe("高亮之中，browsing 的行為照常", () => {
  const [layoutId] = symbols.find((s) => s.id === "window")!.related_layouts;
  const landing = `/layouts/${layoutId}?symbol=window`;
  const planOf = (page: Page) => page.locator(`svg#floorplan-${layoutId}`);

  async function land(page: Page) {
    await page.goto(landing);
    await expect.poll(() => highlightedIds(page)).toEqual(hotspotIdsOf("window", layoutId));
  }

  // 高亮不是一個要先關掉才能繼續的東西（user story 17）。
  // **點在一扇亮著的窗上**是最容易走錯的一下：它看起來像「選這一個」，但使用者從符號頁進來時
  // 根本沒有點過任何東西——這一下是新的第一段，不是第二段的確認。
  test("直接點一扇亮著的窗：高亮清掉，開始新的第一段，而不是跳出說明卡", async ({ page }) => {
    await land(page);

    const win = page.locator("#hs-win-living");
    const box = (await win.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(win).toHaveAttribute("data-state", "candidate");
    await expect(page.locator('#hotspot-layer [data-state="highlighted"]')).toHaveCount(0);
    await expect(page.locator("#info-sheet")).toBeHidden();
    await expect(page.getByRole("status")).toContainText("再點一次確認");
  });

  // 鍵盤那條路（spec「鍵盤路徑」）。Tab 只是焦點在走，使用者還沒選定任何東西——把高亮撕掉，
  // 他就失去剛剛從符號頁帶進來的脈絡。Enter 則與手指的第二段是同一件事：選定了一個熱區。
  test("鍵盤：Tab 走過熱區時高亮留著；Enter 選定一個之後高亮清掉", async ({ page }) => {
    await land(page);

    await page.locator("#hs-door-entry").focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(focused, "Tab 沒有停在熱區上，這條沒測到東西").toMatch(/^hs-/);
    // 全圖時每個熱區都看得見，焦點移動不會改變視野，狀態機回原本的 state、不重畫——
    // 所以這裡讀到的就是 Tab 之後的畫面：Tab 若清掉高亮，那會是一個新 state，按鍵返回前就已經畫上去。
    expect(await highlightedIds(page)).toEqual(hotspotIdsOf("window", layoutId));

    await page.keyboard.press("Enter");
    await expect(page.locator(`#${focused}`)).toHaveAttribute("data-state", "selected");
    await expect(page.locator('#hotspot-layer [data-state="highlighted"]')).toHaveCount(0);
  });

  // 高亮之後我還是能自由縮放與拖曳，自己湊近看某一處（user story 16）。
  // 每一步都先量到圖真的動了，再問高亮——兩者在同一個 state 裡、同一次畫上去，
  // 圖動了卻讀到舊的高亮是不可能的；反過來先讀高亮，就可能讀到手勢還沒畫上去的那一刻。
  test("雙指縮放、拖曳、回到全圖照常，高亮全程留著", async ({ page }) => {
    await land(page);
    const expected = hotspotIdsOf("window", layoutId);
    const plan = planOf(page);
    const fit = (await plan.boundingBox())!;

    await pinch(page, { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 }, 100, 250);
    const zoomed = (await plan.boundingBox())!;
    expect(zoomed.width).toBeCloseTo(fit.width * 2.5, 0);
    expect(await highlightedIds(page)).toEqual(expected);

    const frame = (await page.locator("#floorplan-viewport").boundingBox())!;
    await dragLeft(page, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, 60);
    expect((await plan.boundingBox())!.x).toBeCloseTo(zoomed.x - 60, 0);
    expect(await highlightedIds(page)).toEqual(expected);
    // 拖曳不是點擊：若被當成一下，候選會亮起來、高亮會被清掉。
    await expect(page.locator('#hotspot-layer [data-state="candidate"]')).toHaveCount(0);

    await page.getByRole("button", { name: "回到全圖" }).click();
    await expect.poll(async () => (await plan.boundingBox())!.width).toBeCloseTo(fit.width, 0);
    expect(await highlightedIds(page)).toEqual(expected);
  });

  // 雙擊照樣放大一級。但雙擊的第一下在狀態機眼裡就是一次點擊——手勢層要到第二下才認得出那是雙擊——
  // 而任何一下都清掉高亮（spec「轉換點與高亮」）。所以雙擊之後高亮是清掉的。
  // 這是照 spec 那一條的字面走出來的結果，不是這張票另外做的決定；釘在這裡，哪天要改看得見（docs/adr/0006）。
  test("雙擊照樣放大一級；它的第一下是一次點擊，所以高亮跟著清掉", async ({ page }) => {
    await land(page);
    const plan = planOf(page);
    const fit = (await plan.boundingBox())!;

    await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);

    await expect.poll(async () => (await plan.boundingBox())!.width).toBeCloseTo(fit.width * 2, 0);
    await expect(page.locator('#hotspot-layer [data-state="highlighted"]')).toHaveCount(0);
  });

  // CONTEXT.md 把 highlighted 與 candidate 分開登錄、明講不可互相概括，這一條是那句話在畫面上的樣子。
  // 兩者不會同時出現（點一下就清掉高亮），所以畫成一樣的代價不是「疊在一起看不清」，而是使用者從符號頁
  // 進來、看到一圈跟「點過之後的候選」一模一樣的東西，以為自己已經點過了。
  test("高亮畫出來與候選不同，也與平常的熱區不同", async ({ page }) => {
    await land(page);

    const highlighted = await markingOf(page, "#hs-win-living");
    expect(painted(highlighted.fill), "亮著的窗沒有底色").toBe(true);
    expect(painted(highlighted.stroke), "亮著的窗沒有邊").toBe(true);
    // 平常的熱區（大門，不是窗）在 browsing 下也有一層淡淡的提示——高亮要與它分得開。
    const normal = await markingOf(page, "#hs-door-entry");
    expect(highlighted.fill).not.toBe(normal.fill);
    expect(highlighted.stroke).not.toBe(normal.stroke);

    const win = page.locator("#hs-win-living");
    const box = (await win.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(win).toHaveAttribute("data-state", "candidate");
    const candidate = await markingOf(page, "#hs-win-living");
    expect(highlighted.fill).not.toBe(candidate.fill);
    expect(highlighted.stroke).not.toBe(candidate.stroke);
  });
});

test.describe("建置產物", () => {
  // 讀 `?symbol=` 的元件自己待在一個 Suspense 邊界裡（components/HighlightFromQuery.tsx）。
  // 邊界若包到整個檢視器外面，build 照樣會過、瀏覽器裡照樣會亮——壞掉的是靜態 HTML：
  // 圖整個不在裡面，要等 JavaScript 跑完才畫得出來。這一條只有拿靜態檔案本身來問才問得到。
  test("讀網址參數沒有把平面圖擠出靜態 HTML", () => {
    for (const layoutId of new Set(symbols.flatMap((s) => s.related_layouts))) {
      const html = readFileSync(`out/layouts/${layoutId}.html`, "utf8");
      const hotspots = floorplanOf(layoutId).hotspots.filter((h) => h.symbol_id !== null);
      expect(hotspots.length).toBeGreaterThan(0);
      for (const h of hotspots) {
        expect(html, `${layoutId} 的靜態 HTML 裡沒有熱區 ${h.id}`).toContain(`id="${h.id}"`);
      }
    }
  });

  // 按鈕帶去哪張圖由 related_layouts 決定（spec「路由」：任何地方不得寫死 3b2l_standard）。
  // **這條擋不住寫死格局**：今天 14 筆的 related_layouts 全是同一張圖。它擋得住的是「帶錯符號」、
  // 「漏了哪一頁」、以及「一張圖一顆」變成別的數量——寫死那一道要等第 2 張圖進來才量得出來。
  test("每一張符號頁都有轉換點，帶著自己的符號、去 related_layouts 指的每一張圖", () => {
    for (const s of symbols) {
      const html = readFileSync(`out/symbols/${s.id}.html`, "utf8").replace(
        /<script[\s\S]*?<\/script>/g,
        "",
      );
      const hrefs = [...html.matchAll(/href="(\/layouts\/[^"]*)"/g)].map((m) =>
        m[1].replace(/&amp;/g, "&"),
      );
      expect(hrefs, s.id).toEqual(s.related_layouts.map((id) => `/layouts/${id}?symbol=${s.id}`));
    }
  });
});
