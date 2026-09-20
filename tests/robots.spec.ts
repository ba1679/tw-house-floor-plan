import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const ROBOTS = "out/robots.txt";
const SITEMAP = "out/sitemap.xml";

test.describe("robots.txt", () => {
  test("build 產物裡有 robots.txt，全站都讓抓", () => {
    expect(existsSync(ROBOTS), "out/ 裡沒有 robots.txt").toBe(true);

    const robots = readFileSync(ROBOTS, "utf8");
    expect(robots).toMatch(/^User-Agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow:/m);
  });

  test("Sitemap 指到 sitemap.xml，跟 sitemap 裡列的是同一個網站", () => {
    const robots = readFileSync(ROBOTS, "utf8");
    const sitemapUrl = robots.match(/^Sitemap: (.+)$/m)?.[1];
    expect(sitemapUrl, "robots.txt 沒有 Sitemap 行").toBeTruthy();

    const url = new URL(sitemapUrl!);
    expect(url.pathname).toBe("/sitemap.xml");

    const firstLoc = readFileSync(SITEMAP, "utf8").match(/<loc>([^<]*)<\/loc>/)?.[1];
    expect(url.origin).toBe(new URL(firstLoc!).origin);
  });
});
