import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DISCLAIMER } from "@/lib/ui/copy";
import { selectByTwoTaps } from "./viewer-page";

// PRD §6.4 要的是**每頁固定顯示**，所以這一組刻意不列舉路由。
//
// 列舉會讓這條規則在下一張票落地的那一刻悄悄失效：`/categories/[id]`（票 05）與這張票同一天
// 落地，`/`（票 07）當時還不存在，而它們正是最需要被這條守住的頁面——一份只認得今天有哪些頁的清單，
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

/** 這一頁捲不捲得動。平面圖頁的答案永遠必須是「不能」（ADR-0003）。 */
const pageScrolls = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  );

test.describe("免責聲明的全站頁尾", () => {
  test("build 出來的每一頁都印著免責聲明，一字不改", () => {
    // 「一字不改」問的是 PRD §6.4 那一句本身，所以這裡**再打一次**原文、不從常數拿：從常數
    // import 的斷言只證明頁面與常數一致，證不出常數本身被改壞（同 category-page.spec.ts 的
    // 中文分類名、symbol-page.spec.ts 的 TIER_COPY）。頁面上的字則照舊比對常數。
    expect(DISCLAIMER, "lib/ui/copy.ts 的 DISCLAIMER 與 PRD §6.4 的原文不一致").toBe(
      "本網站符號說明為一般通用慣例，不同建商 / 設計師畫法可能有差異，實際請以個案圖說或現場人員說明為準。",
    );

    const pages = builtPages();
    // 掃到零個檔案時上面那個迴圈會安靜地全過——先確認真的有東西可掃。
    expect(pages.length).toBeGreaterThan(0);
    expect(pages).toContain(join("out", "layouts", "3b2l_standard.html"));
    expect(pages).toContain(join("out", "symbols", "wall.html"));
    // spec Testing Decisions 第 18 條點名首頁。
    expect(pages).toContain(join("out", "index.html"));

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
    await selectByTwoTaps(page, "hs-canopy-master");
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

// 矮螢幕上，這條頁尾會讓框在**兩下點擊之間**變矮：第二段的「重選」列與狀態文字一出現，
// 留白就用完（app/globals.css）。加頁尾之前這件事只在約 524px 以下的螢幕發生，現在門檻約在
// 581px——同一條 RESIZE 高度的路（stage 不動，ADR-0003），從少有人走變成常見手機的日常。
// 測試專案的 812px 走不到它，所以把螢幕調矮再走一次兩段式。
test.describe("矮螢幕：頁尾讓框在兩下點擊之間變矮", () => {
  test.use({ viewport: { width: 375, height: 500 } });

  test("第一段之後框變矮了，第二下仍然選得中原本那個熱區", async ({ page }) => {
    await page.goto(PLAN);
    const frame = page.locator("#floorplan-viewport");
    const door = page.locator("#hs-door-entry");

    const frameBefore = (await frame.boundingBox())!.height;
    const start = (await door.boundingBox())!;
    // 與 two-stage-tap.spec.ts 同一個點法：大門右緣外 13px，在第一段的容錯之內。
    await page.mouse.click(start.x + start.width + 13, start.y + start.height / 2);
    await expect(
      door,
      "第一段的候選沒有留下來——在這個高度，候選一出現「重選」列就把框擠矮；多半是那一次高度的 RESIZE 把第一段丟了（只有寬度變才該退回第一段）",
    ).toHaveAttribute("data-state", "candidate");

    // 前提：這個高度真的會讓框在第二段之前變矮。新版圖面較扁，568px 已只會吃掉留白。
    // 版面哪天改了、500px 擠不到它，這條就不再測
    // 它說它在測的事——帶著訊息失敗，而不是安靜地退化成一條普通的兩段式測試。
    await expect
      .poll(async () => (await frame.boundingBox())!.height, {
        message: "375×500 下框沒有在第一段之後變矮，這條測試的前提已經不成立——換一個更矮的高度",
      })
      .toBeLessThan(frameBefore - 1);

    // 框一變，檢視器要再走一輪 RESIZE 才把視野調好。這個高度下圖面本身可能一 px 都不動，
    // 沒有「看得到的結果」可以等（pan-zoom.spec.ts 等的是圖變扁）；在 RESIZE 之前點下去，
    // 測到的就不是「變矮之後」。所以等大門的位置隔一輪量起來不再變，才算調好。
    let previous: { x: number; y: number; width: number } | null = null;
    await expect
      .poll(
        async () => {
          const now = (await door.boundingBox())!;
          const still =
            previous !== null &&
            Math.abs(now.x - previous.x) < 0.5 &&
            Math.abs(now.y - previous.y) < 0.5 &&
            Math.abs(now.width - previous.width) < 0.5;
          previous = now;
          return still;
        },
        { intervals: [100] },
      )
      .toBe(true);

    const zoomed = (await door.boundingBox())!;
    const frameBox = (await frame.boundingBox())!;
    const target = { x: zoomed.x + zoomed.width / 2, y: zoomed.y + zoomed.height / 2 };
    expect(
      target.y > frameBox.y && target.y < frameBox.y + frameBox.height,
      "大門被變矮的框擠出畫面外了，第二段無從點起",
    ).toBe(true);
    await page.mouse.click(target.x, target.y);

    await expect(door).toHaveAttribute("data-state", "selected");
    await expect(page.getByRole("status")).toContainText("雙開門");
    expect(await pageScrolls(page), "矮螢幕上平面圖頁被撐成可捲的").toBe(false);
  });
});
