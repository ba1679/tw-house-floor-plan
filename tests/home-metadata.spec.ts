import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const BASE_URL = "https://floorplan.example.test";
const HOME = "out/index.html";

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

function outPathFromUrl(url: string) {
  return `out${new URL(url).pathname}`;
}

test.describe("home metadata", () => {
  test("首頁輸出 canonical、Open Graph、JSON-LD 與圖示資產", () => {
    const html = readFileSync(HOME, "utf8");
    const canonical = BASE_URL;
    const image = `${BASE_URL}/brand/og-home.svg`;

    expect(linkHref(html, "canonical")).toBe(canonical);

    expect(metaContent(html, "og:title")).toBe("平面圖教學：看懂建案平面圖上的符號");
    expect(metaContent(html, "og:description")).toBe(
      "教買房的人看懂建案平面圖：點圖上的符號，就知道它是什麼、該注意什麼，以及這個說法出自哪一級文件。也可以直接搜尋，或依分類瀏覽。",
    );
    expect(metaContent(html, "og:type")).toBe("website");
    expect(metaContent(html, "og:url")).toBe(canonical);
    expect(metaContent(html, "og:site_name")).toBe("平面圖教學");
    expect(metaContent(html, "og:locale")).toBe("zh_TW");
    expect(metaContent(html, "og:image")).toBe(image);
    expect(metaContent(html, "og:image:width")).toBe("1200");
    expect(metaContent(html, "og:image:height")).toBe("630");

    expect(linkHref(html, "icon")).toBe("/brand/favicon.svg");
    expect(linkHref(html, "apple-touch-icon")).toBe("/brand/apple-touch-icon.png");

    for (const assetUrl of [image, `${BASE_URL}/brand/favicon.svg`, `${BASE_URL}/brand/apple-touch-icon.png`]) {
      expect(existsSync(outPathFromUrl(assetUrl)), `${assetUrl} 沒有出現在 out/`).toBe(true);
    }

    const [jsonLd] = jsonLdBlocks(html);
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "平面圖教學",
      description:
        "教買房的人看懂建案平面圖：點圖上的符號，就知道它是什麼、該注意什麼，以及這個說法出自哪一級文件。也可以直接搜尋，或依分類瀏覽。",
      url: canonical,
      inLanguage: "zh-Hant",
    });
  });

  test("首頁 metadata 不輸出 localhost", () => {
    const html = readFileSync(HOME, "utf8");

    expect(html).not.toContain("localhost");
    expect(linkHref(html, "canonical")).toMatch(/^https:\/\/floorplan\.example\.test\/?$/);
    expect(metaContent(html, "og:image")).toMatch(/^https:\/\/floorplan\.example\.test\//);
  });
});
