import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";

// 符號頁是**搜尋落地頁**：有人在 Google 打「平面圖上的虛線是什麼」，點進來就落在這裡。
// 他沒看過首頁，也不會往上找導覽，所以這一頁必須自己站得住（PRD §6.2.1）。
//
// 大半的斷言讀的是 `out/` 裡的建置產物而不是瀏覽器：要驗的正是「內容在 HTML 裡就有，
// 不必執行 JavaScript 才讀得到」（spec user story 33）——那件事只有拿靜態檔案本身來問才問得到。
// 要量尺寸、走 Tab、點連結的那幾條才進瀏覽器。

type RawSymbol = {
  id: string;
  name: string;
  category: string;
  svg_ref: string;
  plain_meaning: string;
  caution: string | null;
  source_tier: string;
  confused_with: { symbol_id: string; difference: string }[];
};

const symbols: RawSymbol[] = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")).symbols;
const sprite = readFileSync("data/symbols.sprite.svg", "utf8");

const nameOf = (id: string) => symbols.find((s) => s.id === id)!.name;
const built = (id: string) => readFileSync(`out/symbols/${id}.html`, "utf8");

/**
 * 把一頁建置產物還原成純文字：標籤拿掉、React 逸出過的字還原。
 * 「頁面上的字與資料檔一字不差」問的是讀者看到什麼，不是 HTML 長什麼樣。
 */
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

/** sprite 裡那一格畫的是什麼——一字不改的那一段 SVG。 */
function spriteMarkup(svgRef: string) {
  const match = new RegExp(`<symbol id="${svgRef}"[^>]*>([\\s\\S]*?)</symbol>`).exec(sprite);
  expect(match, `sprite 裡找不到 ${svgRef}`).toBeTruthy();
  return match![1].trim();
}

test.describe("/symbols/[id] 符號頁", () => {
  test("每個符號都有自己的一頁，而且由資料決定有哪些頁", () => {
    const fromData = symbols.map((s) => s.id).sort();
    const fromBuild = readdirSync("out/symbols")
      .filter((name) => name.endsWith(".html"))
      .map((name) => name.replace(".html", ""))
      .sort();

    expect(fromBuild).toEqual(fromData);
  });

  test("打開一個符號的網址就看到那一頁；資料裡沒有的 id 沒有頁面", async ({ page }) => {
    const ok = await page.goto("/symbols/wall");
    expect(ok?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("牆");

    const missing = await page.goto("/symbols/nonexistent_symbol");
    expect(missing?.status()).toBe(404);
  });

  // 標題要長得像使用者剛才打進 Google 的那句話，不是把 name 直接印出來（PRD §6.2.1）。
  test("標題是搜尋意圖的問句，14 頁彼此不同，也不等於根版面的標題", () => {
    const titles = symbols.map((s) => titleOf(built(s.id)));

    for (const [i, s] of symbols.entries()) {
      expect(titles[i]).toBe(`平面圖上的${s.name}是什麼？`);
    }
    expect(new Set(titles).size).toBe(symbols.length);
    expect(titles).not.toContain("平面圖教學");
  });

  // 14 頁共用一句描述，搜尋引擎會把它們當成同一頁（spec user story 31）。
  test("每頁有自己的 meta description，而且說得出這個符號是什麼", () => {
    const descriptions = symbols.map((s) => descriptionOf(built(s.id)));

    for (const [i, s] of symbols.entries()) {
      expect(descriptions[i]).toBeTruthy();
      expect(descriptions[i]).toContain(s.plain_meaning);
    }
    expect(new Set(descriptions).size).toBe(symbols.length);
    expect(descriptions).not.toContain(descriptionOf(readFileSync("out/layouts/3b2l_standard.html", "utf8")));
  });

  // 內容維護者改一次資料，符號頁、說明卡、分類頁一起改（spec user story 34）。
  // 所以測的是「頁面上出現的就是資料裡那一字不差的字串」，不是「頁面上有些字」。
  test("白話意思與每一則『容易搞混』都與資料一字不差", () => {
    for (const s of symbols) {
      const text = textOf(built(s.id));
      expect(text, s.id).toContain(s.plain_meaning);
      for (const other of s.confused_with) {
        expect(text, `${s.id} → ${other.symbol_id}`).toContain(other.difference);
        expect(text, `${s.id} → ${other.symbol_id}`).toContain(nameOf(other.symbol_id));
      }
    }
  });

  // 14 筆裡只有雨遮有 caution。留一個空標題會讓另外 13 頁看起來像壞掉。
  test("caution 為 null 的符號整區不出現；雨遮那頁有", () => {
    const withCaution = symbols.filter((s) => s.caution);
    expect(withCaution.map((s) => s.id)).toEqual(["canopy_rain"]);

    for (const s of symbols) {
      const text = textOf(built(s.id));
      if (s.caution) {
        expect(text, s.id).toContain("注意事項");
        expect(text, s.id).toContain(s.caution);
      } else {
        expect(text, s.id).not.toContain("注意事項");
      }
    }
  });

  // 本站的核心差異化：不只給答案，而是給這個答案硬到什麼程度（PRD §6.5）。
  // 資料裡目前只有 cns / regulation / convention 三種，varies 沒有實例——
  // 第四種的文案由 `SOURCE_TIER_BADGES` 的型別（以 tier 為 key 的 Record）擋住，少一個直接編譯失敗。
  test("每一頁的來源徽章說得出這個符號的答案出自哪一級文件", () => {
    const TIER_COPY: Record<string, { label: string; explainer: string }> = {
      cns: { label: "CNS 標準", explainer: "此符號的畫法在中華民國國家標準中有明文規定。" },
      regulation: { label: "法規依據", explainer: "此符號或其設置規定，在現行法規中有明文條文。" },
      convention: {
        label: "業界慣例",
        explainer: "常見於台灣建築圖說，但沒有標準或法規明文，不同建商可能有不同畫法。",
      },
      varies: {
        label: "畫法不一",
        explainer:
          "查到的來源彼此分歧。這不是我們沒查，是實務上真的沒有統一畫法——請以個案圖說為準。",
      },
    };

    for (const s of symbols) {
      const text = textOf(built(s.id));
      const copy = TIER_COPY[s.source_tier];
      expect(copy, `${s.id} 的 source_tier ${s.source_tier} 沒有對應文案`).toBeTruthy();
      expect(text, s.id).toContain(copy.label);
      expect(text, s.id).toContain(copy.explainer);
    }
  });

  // 本站的核心承諾：符號頁上認得的形狀，回到平面圖上找得到（PRD §12）。
  // 主圖與 sprite 站在同一套畫法上（ADR-0005），所以符號頁用 sprite 就自動一致——
  // 另外畫一套的那一天，這條會紅。
  test("符號圖形一字不改地取自 sprite，不另外畫一套", () => {
    for (const s of symbols) {
      expect(built(s.id), s.id).toContain(spriteMarkup(s.svg_ref));
    }
  });

  // verification_status 描述的是「我們查證做到哪」，與 source_tier 是兩條軸，不上前台（CONTEXT.md）。
  test("verification_status 的四個值都不出現在任何一頁裡", () => {
    for (const s of symbols) {
      const html = built(s.id);
      for (const value of ["verified", "partial", "pending_purchase", "blocked"]) {
        expect(html, `${s.id} 的頁面出現了 ${value}`).not.toContain(value);
      }
    }
  });

  // 說明卡那份投影會被序列化進每一張平面圖頁的 props：多一個欄位就是 14 筆 × 每張圖。
  // 符號頁要的欄位比說明卡多，但**不得**加進那一份。
  test("平面圖頁的產物沒有因為符號頁而夾帶查證欄位", () => {
    const html = readFileSync("out/layouts/3b2l_standard.html", "utf8");
    for (const field of ["verification_status", "source_refs", "ai_description", "detection_hints", "_pilot_note"]) {
      expect(html, `平面圖頁夾帶了 ${field}`).not.toContain(field);
    }
  });

  test("『容易搞混』的每一則都連得到對方的符號頁", async ({ page }) => {
    const wall = symbols.find((s) => s.id === "wall")!;
    await page.goto("/symbols/wall");

    for (const other of wall.confused_with) {
      await expect(page.locator(`a[href="/symbols/${other.symbol_id}"]`)).toBeVisible();
    }

    const first = wall.confused_with[0];
    await page.locator(`a[href="/symbols/${first.symbol_id}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(nameOf(first.symbol_id));
  });

  // 圖不是裝飾：它是這一頁在教的東西，讀螢幕的人要知道那畫的是這個符號在平面圖上的樣子。
  test("符號圖形有替代文字，而且說得出那畫的是什麼", async ({ page }) => {
    await page.goto("/symbols/wall");
    await expect(page.getByRole("img", { name: "牆在平面圖上的畫法" })).toBeVisible();
  });

  test("Tab 走得完頁面上所有可操作的東西", async ({ page }) => {
    await page.goto("/symbols/wall");

    const expected = await page.locator("a[href]").evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute("href")),
    );
    expect(expected.length).toBeGreaterThan(0);

    const visited: (string | null)[] = [];
    for (let i = 0; i < expected.length; i++) {
      await page.keyboard.press("Tab");
      visited.push(
        await page.evaluate(() => document.activeElement?.getAttribute("href") ?? null),
      );
    }

    expect(visited).toEqual(expected);
  });

  // 兩張各代表一種：牆沒有 caution、雨遮有——而有 caution 的那一頁是唯一多一個區塊的。
  test("在 375px 手機寬度下不溢出、不橫向捲動", async ({ page }) => {
    for (const id of ["wall", "canopy_rain"]) {
      await page.goto(`/symbols/${id}`);
      // 先確認站在符號頁上：404 頁也不會溢出，那樣這條就成了一個永遠是綠的斷言。
      await expect(page.getByRole("img", { name: `${nameOf(id)}在平面圖上的畫法` })).toBeVisible();

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows, id).toBe(false);
    }
  });
});
