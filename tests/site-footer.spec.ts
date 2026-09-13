import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DISCLAIMER } from "@/lib/ui/copy";

// PRD §6.4 要的是**每頁固定顯示**，所以這一組刻意不列舉路由。
//
// 列舉會讓這條規則在下一張票落地的那一刻悄悄失效：`/` 與 `/categories/[id]` 現在還不存在
// （票 07、票 05），而它們正是最需要被這條守住的頁面——一份只認得今天有哪些頁的清單，
// 明天多一頁時不會紅，只會少測一頁。改成掃過 `out/` 裡的每一個 `.html`，
// 新頁面一產生就自動被要求帶著這句話，不必回頭改測試。
//
// **404 也算一頁，不排除。** 它同樣由根版面產出，把免責放進根版面的理由就是這個：
// 頁面不必知道自己要掛免責，掛在框上，落在哪一頁都有。

const PLAN = "/layouts/3b2l_standard";

/** `out/` 底下所有建置產物的路徑。 */
function builtPages(dir = "out"): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return builtPages(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

/**
 * 把一頁建置產物還原成純文字。**`<script>` 先拿掉**：Next 會把整棵樹再序列化一份
 * 進 hydration 的 payload，留著的話「這句話印在頁面上」與「這句話夾在 JS 裡」
 * 兩件事就分不出來，而這條要問的是前者。
 */
const textOf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

/** 頁尾那一份。`<footer>` 是 contentinfo 地標，讀螢幕的人跳得到。 */
const footerOf = (page: Page) => page.getByRole("contentinfo");

/** 兩段式選到指定熱區：點大略位置放大，再點一次確認（與 info-sheet.spec.ts 同一套）。 */
async function select(page: Page, hotspotId: string) {
  const target = page.locator(`#${hotspotId}`);
  const before = (await target.boundingBox())!;
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
  const zoomed = (await target.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(target, `${hotspotId} 沒有被選中，後面的斷言都不算數`).toHaveAttribute(
    "data-state",
    "selected",
  );
}

/** 這一頁捲不捲得動。平面圖頁的答案永遠必須是「不能」（ADR-0003）。 */
const pageScrolls = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  );

test.describe("免責聲明的全站頁尾", () => {
  test("build 出來的每一頁都印著免責聲明，一字不改", () => {
    const pages = builtPages();
    // 掃到零個檔案時上面那個迴圈會安靜地全過——先確認真的有東西可掃。
    expect(pages.length).toBeGreaterThan(0);
    expect(pages).toContain(join("out", "layouts", "3b2l_standard.html"));
    expect(pages).toContain(join("out", "symbols", "wall.html"));

    for (const path of pages) {
      expect(textOf(readFileSync(path, "utf8")), `${path} 沒有免責聲明`).toContain(DISCLAIMER);
    }
  });

  test("符號頁捲到底看得到它", async ({ page }) => {
    await page.goto("/symbols/wall");
    const footer = footerOf(page);
    await expect(footer).toContainText(DISCLAIMER);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const box = (await footer.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y + box.height, "捲到底了還是看不到整條頁尾").toBeLessThanOrEqual(
      viewport.height + 1,
    );
  });

  // 這一頁**不捲動**：說明卡是版面裡的一列，頁面若可捲，卡片與圖的相對位置會隨捲動改變
  // （ADR-0003）。所以頁尾在這裡不能是「接在內容後面」的一塊，必須是框裡的最後一列。
  test("平面圖頁不捲動，頁尾仍然在畫面上", async ({ page }) => {
    await page.goto(PLAN);

    await expect(footerOf(page)).toBeInViewport();
    expect(await pageScrolls(page), "平面圖頁被頁尾撐成一頁可捲的頁").toBe(false);
  });

  // 卡片自己那一份要留著：兩份服務的是不同時刻的同一個人。
  //
  // 但票面說的「卡片升起來時會蓋住頁尾」不成立——卡片是版面裡的一列（ADR-0003），
  // 頁尾是它下面的另一列，兩列並存就是同一句話一前一後印兩次。所以卡片一升起頁尾就讓位，
  // 卡片一收頁尾就回來。
  //
  // 兩個方向都要釘住，而且每個方向都要**兩半**：「頁尾藏起來了」單獨成立的話，
  // 兩份一起不見也會過——那是 §6.4 失效，比印兩份更糟。所以卡片升起時同時斷言
  // 「頁尾不在」與「卡片那一份在」，再數一次畫面上剛好一份。
  test("說明卡升起、展開、收起：畫面上始終剛好一份免責，而且這一頁始終不捲動", async ({
    page,
  }) => {
    const sheet = page.locator("#info-sheet");
    const sheetCopy = sheet.getByText(DISCLAIMER, { exact: true });
    const visibleCopies = page.getByText(DISCLAIMER, { exact: true }).filter({ visible: true });

    await page.goto(PLAN);
    // 卡片沒升起：頁尾那一份在，卡片不在。
    await expect(footerOf(page)).toBeVisible();
    await expect(footerOf(page).getByText(DISCLAIMER, { exact: true })).toBeVisible();
    await expect(sheet).toHaveCount(0);
    await expect(visibleCopies).toHaveCount(1);

    // 雨遮是唯一有注意事項的符號，卡片內容最長、也是唯一展得開的一張。
    await select(page, "hs-canopy-master");
    await expect(footerOf(page), "說明卡升起來了，頁尾卻沒有讓位").toBeHidden();
    await expect(sheetCopy, "頁尾讓位了，卡片裡卻沒有接手的那一份").toBeVisible();
    await expect(visibleCopies).toHaveCount(1);
    expect(await pageScrolls(page), "說明卡升起來之後頁面變成可捲的").toBe(false);

    await page.getByRole("button", { name: /上拉看完整內容/ }).click();
    await expect(sheet).toHaveAttribute("data-expanded", "true");
    await expect(footerOf(page)).toBeHidden();
    await expect(sheetCopy).toBeVisible();
    await expect(visibleCopies).toHaveCount(1);
    expect(await pageScrolls(page), "說明卡展開之後頁面變成可捲的").toBe(false);

    // 卡片收起：頁尾回來，而且回到畫面上，不是回到第一屏之外。
    await sheet.getByRole("button", { name: "關閉說明" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(footerOf(page), "說明卡收起來之後頁尾沒有回來").toBeInViewport();
    await expect(visibleCopies).toHaveCount(1);
    expect(await pageScrolls(page)).toBe(false);
  });

  // 頁尾是一句話，不是一個控制元件。塞一個可聚焦的東西進去，會多出一站
  // 站在每一頁每一條 Tab 路徑的盡頭（tests/keyboard.spec.ts、符號頁的 Tab 那條）。
  test("頁尾裡沒有可聚焦的東西", async ({ page }) => {
    await page.goto("/symbols/wall");
    // 先確認頁尾真的在：沒有頁尾的頁面數出來也是 0，那樣這條就成了一個永遠是綠的斷言。
    await expect(footerOf(page)).toBeVisible();

    const focusable = await footerOf(page)
      .locator("a[href], button, input, select, textarea, [tabindex]")
      .count();
    expect(focusable).toBe(0);
  });
});
