import { expect, test } from "@playwright/test";

test("GA 指令以 gtag 可處理的 arguments 送出頁面與產品事件", async ({ page }) => {
  // Only inspect our side of the tag boundary; this test never contacts Google.
  await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  await page.goto("/symbols/window");

  await expect
    .poll(() =>
      page.evaluate(() => {
        const layer = (window as Window & { dataLayer?: unknown[] }).dataLayer ?? [];
        return layer
          .filter((entry): entry is IArguments => typeof entry === "object" && entry !== null && "0" in entry)
          .map((entry) => ({
            command: entry[0],
            name: entry[1] instanceof Date ? "date" : entry[1],
            type: Object.prototype.toString.call(entry),
          }));
      }),
    )
    .toEqual([
      { command: "js", name: "date", type: "[object Arguments]" },
      { command: "config", name: expect.stringMatching(/^G-[A-Z0-9]+$/), type: "[object Arguments]" },
      { command: "event", name: "symbol_view", type: "[object Arguments]" },
    ]);
});
