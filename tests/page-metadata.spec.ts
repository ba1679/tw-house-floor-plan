import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { isNoindex } from "./built-html";

const BASE_URL = "https://floorplan.example.test";
const OG_IMAGE = `${BASE_URL}/brand/og-home.png`;

type RawSymbol = {
  id: string;
  name: string;
  category: string;
  plain_meaning: string;
};

type FloorPlan = {
  id: string;
  name: string;
  hotspots: { symbol_id: string | null }[];
};

const symbols: RawSymbol[] = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")).symbols;
const floorplans: FloorPlan[] = readdirSync("data/layouts")
  .filter((name) => name.endsWith(".floorplan.json"))
  .map((name) => JSON.parse(readFileSync(`data/layouts/${name}`, "utf8")));

const CATEGORY_ZH: Record<string, string> = {
  structure: "結構",
  door_window: "門窗",
  furniture: "家具家配",
};

const htmlOf = (path: string) => readFileSync(`out/${path}`, "utf8");
const symbolHtml = (id: string) => htmlOf(`symbols/${id}.html`);
const categoryHtml = (id: string) => htmlOf(`categories/${id}.html`);
const layoutHtml = (id: string) => htmlOf(`layouts/${id}.html`);

const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

function tags(html: string, tagName: string) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "g"))].map((match) => match[0]);
}

function metaContent(html: string, key: string) {
  const tag = tags(html, "meta").find((candidate) => attr(candidate, "name") === key || attr(candidate, "property") === key);
  return tag ? attr(tag, "content") : undefined;
}

function linkHref(html: string, rel: string) {
  const tag = tags(html, "link").find((candidate) => attr(candidate, "rel") === rel);
  return tag ? attr(tag, "href") : undefined;
}

function jsonLdBlocks(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map((match) =>
    JSON.parse(match[1]),
  );
}

function symbolTitle(symbol: RawSymbol) {
  return `平面圖上的${symbol.name}是什麼？`;
}

function symbolDescription(symbol: RawSymbol) {
  return `${symbol.plain_meaning}本頁同時標示這個說法出自哪一級文件，你可以自己判斷要不要信。`;
}

function categorySymbols(category: string) {
  return symbols.filter((symbol) => symbol.category === category);
}

function categoryTitle(category: string) {
  return `平面圖上的${CATEGORY_ZH[category]}符號有哪些？`;
}

function categoryDescription(category: string) {
  const names = categorySymbols(category).map((symbol) => symbol.name);
  return `${CATEGORY_ZH[category]}類的平面圖符號共 ${names.length} 個：${names.join("、")}。每一個都說得出它是什麼，以及這個說法出自哪一級文件。`;
}

function layoutTitle(floorplan: FloorPlan) {
  return `${floorplan.name}平面圖怎麼看？`;
}

function layoutDescription(floorplan: FloorPlan) {
  return `一張點得動的${floorplan.name}平面圖。點圖上的符號，就知道它是什麼、該注意什麼，以及這個說法出自哪一級文件。`;
}

function expectSharedOpenGraph(html: string, title: string, description: string, url: string) {
  expect(metaContent(html, "og:title"), url).toBe(title);
  expect(metaContent(html, "og:description"), url).toBe(description);
  expect(metaContent(html, "og:type"), url).toBe("website");
  expect(metaContent(html, "og:url"), url).toBe(url);
  expect(metaContent(html, "og:site_name"), url).toBe("拼厝");
  expect(metaContent(html, "og:locale"), url).toBe("zh_TW");
  expect(metaContent(html, "og:image"), url).toBe(OG_IMAGE);
  expect(metaContent(html, "og:image:type"), url).toBe("image/png");
  expect(metaContent(html, "og:image:width"), url).toBe("1200");
  expect(metaContent(html, "og:image:height"), url).toBe("630");
}

test.describe("page metadata and JSON-LD", () => {
  test("每張 Symbol 頁都有乾淨 canonical、Open Graph 與 DefinedTerm JSON-LD", () => {
    for (const symbol of symbols) {
      const html = symbolHtml(symbol.id);
      const url = `${BASE_URL}/symbols/${symbol.id}`;
      expect(linkHref(html, "canonical"), symbol.id).toBe(url);
      expectSharedOpenGraph(html, symbolTitle(symbol), symbolDescription(symbol), url);

      const blocks = jsonLdBlocks(html);
      expect(blocks, symbol.id).toHaveLength(1);
      expect(blocks[0]).toEqual({
        "@context": "https://schema.org",
        "@type": "DefinedTerm",
        name: symbol.name,
        description: symbol.plain_meaning,
        url,
        inDefinedTermSet: {
          "@type": "DefinedTermSet",
          name: "拼厝",
          url: BASE_URL,
        },
      });
    }
  });

  test("Symbol 頁 query 不會改變 canonical 或 Open Graph URL", async ({ page }) => {
    await page.goto("/symbols/window?from=category&utm_source=example");

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${BASE_URL}/symbols/window`,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      `${BASE_URL}/symbols/window`,
    );
  });

  test("每張分類頁的 CollectionPage JSON-LD 與畫面清單同源", () => {
    for (const category of [...new Set(symbols.map((symbol) => symbol.category))]) {
      const html = categoryHtml(category);
      const url = `${BASE_URL}/categories/${category}`;
      expect(linkHref(html, "canonical"), category).toBe(url);
      expectSharedOpenGraph(html, categoryTitle(category), categoryDescription(category), url);

      const [jsonLd] = jsonLdBlocks(html);
      expect(jsonLd["@type"], category).toBe("CollectionPage");
      expect(jsonLd.name, category).toBe(categoryTitle(category));
      expect(jsonLd.description, category).toBe(categoryDescription(category));
      expect(jsonLd.url, category).toBe(url);
      expect(jsonLd.inLanguage, category).toBe("zh-Hant");
      expect(jsonLd.mainEntity.itemListElement, category).toEqual(
        categorySymbols(category).map((symbol, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${BASE_URL}/symbols/${symbol.id}`,
          name: symbol.name,
          description: symbol.plain_meaning,
        })),
      );
    }
  });

  test("每張 Layout 頁的 LearningResource JSON-LD 只描述實際頁面內容", () => {
    for (const floorplan of floorplans) {
      const html = layoutHtml(floorplan.id);
      const url = `${BASE_URL}/layouts/${floorplan.id}`;
      expect(linkHref(html, "canonical"), floorplan.id).toBe(url);
      expectSharedOpenGraph(html, layoutTitle(floorplan), layoutDescription(floorplan), url);

      const taught = [
        ...new Set(
          floorplan.hotspots
            .map((hotspot) => hotspot.symbol_id)
            .filter((id): id is string => id !== null)
            .map((id) => symbols.find((symbol) => symbol.id === id)!.name),
        ),
      ];
      const [jsonLd] = jsonLdBlocks(html);
      expect(jsonLd).toEqual({
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: layoutTitle(floorplan),
        description: layoutDescription(floorplan),
        url,
        inLanguage: "zh-Hant",
        isAccessibleForFree: true,
        educationalUse: "辨認建案平面圖符號",
        teaches: taught,
      });
    }
  });

  test("找找看維持 noindex，有基本分享 metadata，但完全沒有 JSON-LD", () => {
    const floorplan = floorplans.find((candidate) => candidate.id === "3b2l_standard")!;
    const html = htmlOf("layouts/3b2l_standard/quiz.html");
    const url = `${BASE_URL}/layouts/3b2l_standard/quiz`;

    expect(isNoindex(html)).toBe(true);
    expect(linkHref(html, "canonical")).toBe(url);
    expectSharedOpenGraph(
      html,
      `${floorplan.name}找找看：這張平面圖上的符號你認得幾個？`,
      `在一張${floorplan.name}平面圖上，照題目把符號找出來，看看自己認得幾個。`,
      url,
    );
    expect(jsonLdBlocks(html)).toEqual([]);
  });

  test("JSON-LD 不輸出 Article、FAQ、rating 或頁面不存在的結構", () => {
    for (const html of [
      htmlOf("index.html"),
      ...symbols.map((symbol) => symbolHtml(symbol.id)),
      ...[...new Set(symbols.map((symbol) => symbol.category))].map(categoryHtml),
      ...floorplans.map((floorplan) => layoutHtml(floorplan.id)),
    ]) {
      const serialized = JSON.stringify(jsonLdBlocks(html));
      expect(serialized).not.toContain("Article");
      expect(serialized).not.toContain("FAQ");
      expect(serialized).not.toContain("rating");
      expect(serialized).not.toContain("AggregateRating");
    }
  });
});
