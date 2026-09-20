import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";

// Vercel 對靜態匯出的 `.html` 只認乾淨網址：`/google….html` 是 404，`/google…` 才是 200。
// 而 Search Console 的驗證檔非得從 `.html` 那個網址讀到不可，所以 `public/` 底下每一個 `.html`
// 都要在 `vercel.json` 有一條 rewrite 把 `.html` 網址接到乾淨網址。
// 本機的 `scripts/serve-static.mjs` 兩種網址都認，本機測不出這個洞，所以直接比設定檔。

const rewrites: { source: string; destination: string }[] = JSON.parse(readFileSync("vercel.json", "utf8")).rewrites;

const publicHtml = readdirSync("public", { recursive: true, encoding: "utf8" }).filter((path) => path.endsWith(".html"));

test.describe("vercel.json", () => {
  test("public/ 的每一個 .html 都有一條 rewrite 接到乾淨網址", () => {
    // 零個檔案時底下的迴圈會安靜地全過。
    expect(publicHtml.length).toBeGreaterThan(0);

    for (const file of publicHtml) {
      const rewrite = rewrites.find((r) => r.source === `/${file}`);
      expect(rewrite, `vercel.json 沒有 /${file} 的 rewrite`).toBeTruthy();
      expect(rewrite!.destination).toBe(`/${file.slice(0, -".html".length)}`);
    }
  });
});
