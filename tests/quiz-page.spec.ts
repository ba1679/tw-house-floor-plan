import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { descriptionOf, isNoindex, titleOf } from "./built-html";
import {
  PLAN,
  QUIZ,
  ROUND_SIZE,
  answerByTwoTaps,
  cleanHotspotsOf,
  currentTarget,
  floorplans,
  idOfName,
  nextOf,
  onPlan,
  otherThan,
  planOf,
  progressOf,
  progressText,
  questionNameOf,
  startRound,
  statusOf,
  viewportOf,
} from "./quiz-play";
import { blankSpot, dragLeft, pinch } from "./viewer-page";

// 找找看頁（M4 票 01）：一局從「開始」玩到結算。
// 資料、定位、怎麼作答收在 `quiz-play.ts`：作答之後（票 02）、學習進度（票 04）問的是同一局。

/** 首次引導那一句（與 affordance-hint.spec.ts 同一句：兩頁共用）。 */
const TAP_HINT = "點圖上任何一個位置，我們會放大讓你看清楚";

/**
 * 等 client 決定了要不要說首次引導（同 affordance-hint.spec.ts 的 `decided`）。
 * 它只是一道閘門：少了它，「不該出現引導」會在 client 接手之前量到一個空的狀態列而通過。
 */
async function hintDecided(page: Page) {
  await expect(page.locator("#hotspot-layer")).toHaveAttribute("data-hint", /on|off/);
}

test.describe("找找看頁", () => {
  test("以 layout id 定址：有自己的標題與描述，帶 noindex", async ({ request }) => {
    const quiz = await request.get(QUIZ);
    expect(quiz.status()).toBe(200);
    const html = await quiz.text();

    // noindex 看頁面自己的宣告：一局的題目是隨機的，搜尋結果上沒有東西可以給人看。
    expect(isNoindex(html), "找找看頁沒有宣告 noindex").toBe(true);

    const planHtml = await (await request.get(PLAN)).text();
    expect(titleOf(html)).toBeTruthy();
    expect(titleOf(html), "找找看頁沿用了平面圖頁的標題").not.toBe(titleOf(planHtml));
    expect(descriptionOf(html)).toBeTruthy();
    expect(descriptionOf(html), "找找看頁沿用了平面圖頁的描述").not.toBe(descriptionOf(planHtml));
  });

  // 產生哪幾頁由「有可出題符號的 layout」決定（spec「路由與頁面」），不寫死 3b2l_standard。
  // 真資料裡每一張圖都有熱區，所以「沒有可出題符號就不產生」這一半只能靠同一個判斷在這裡成立。
  test("每一張有熱區的圖各產生一頁找找看", () => {
    const withHotspots = floorplans.filter((fp) => fp.hotspots.some((h) => h.symbol_id !== null));
    expect(withHotspots.length).toBeGreaterThan(0);

    for (const fp of floorplans) {
      expect(existsSync(`out/layouts/${fp.id}/quiz.html`), fp.id).toBe(withHotspots.includes(fp));
    }
  });

  test("按「開始」出第 1 題：題號 1 / 7，題目是這張圖上某個符號的名字原文", async ({ page }) => {
    await page.goto(QUIZ);
    await page.getByRole("button", { name: "開始" }).click();

    await expect(progressOf(page)).toHaveText(progressText(1));
    const name = (await questionNameOf(page).textContent())!;
    expect(onPlan.includes(idOfName(name)!), `「${name}」不是這張圖上有熱區的符號`).toBe(true);
  });

  test("一局照順序玩到結算：7 題互不重複、都是這張圖上的符號，全部答對就是 7 / 7", async ({ page }) => {
    await startRound(page);

    const asked: string[] = [];
    for (let i = 1; i <= ROUND_SIZE; i++) {
      await expect(progressOf(page)).toHaveText(progressText(i));
      const target = await currentTarget(page);
      asked.push(target);

      await answerByTwoTaps(page, cleanHotspotsOf(target)[0]);
      await expect(statusOf(page)).toContainText("答對了。");
      await nextOf(page).click();
    }

    expect(new Set(asked).size, `一局出了重複的題目：${asked}`).toBe(ROUND_SIZE);
    for (const id of asked) expect(onPlan.includes(id), `${id} 不是這張圖上有熱區的符號`).toBe(true);
    await expect(page.getByText(`答對 ${ROUND_SIZE} / ${ROUND_SIZE} 題`)).toBeVisible();
    await expect(progressOf(page)).toBeHidden();
  });

  test("點中別的符號是答錯；點中題目符號的哪一處都算對", async ({ page }) => {
    await startRound(page);

    await answerByTwoTaps(page, cleanHotspotsOf(otherThan(await currentTarget(page)))[0]);
    await expect(statusOf(page)).toContainText("答錯了。");
    await nextOf(page).click();

    // 第 2 題起點題目符號的**最後一處**：上一條測試點的是第一處。窗有 9 處，點中哪一扇都是窗（PRD §6.3.2）。
    for (let i = 2; i <= ROUND_SIZE; i++) {
      await expect(progressOf(page)).toHaveText(progressText(i));
      await answerByTwoTaps(page, cleanHotspotsOf(await currentTarget(page)).at(-1)!);
      await expect(statusOf(page)).toContainText("答對了。");
      await nextOf(page).click();
    }

    await expect(page.getByText(`答對 ${ROUND_SIZE - 1} / ${ROUND_SIZE} 題`)).toBeVisible();
  });

  // CONTEXT.md「作答」：第一段圈出候選、「重選」、第二段沒點中都不是作答。步驟照 two-stage-tap.spec.ts 那幾條。
  test("第一段圈出候選、第二段沒點中、按「重選」：都不算作答", async ({ page }) => {
    await startRound(page);
    const door = page.locator("#hs-door-entry");

    const start = (await door.boundingBox())!;
    await page.mouse.click(start.x + start.width + 13, start.y + start.height / 2);
    await expect(door).toHaveAttribute("data-state", "candidate");
    await expect(nextOf(page), "第一段不是作答").toBeHidden();

    // 第二段容錯 30 CSS px：離候選 50px 是「還是沒點到」。
    const zoomed = (await door.boundingBox())!;
    await page.mouse.click(zoomed.x + zoomed.width + 50, zoomed.y + zoomed.height / 2);
    await expect(statusOf(page)).toContainText("還是沒點到");
    await expect(nextOf(page), "第二段沒點中不是作答").toBeHidden();

    await page.getByRole("button", { name: "重選" }).click();
    await expect(door).toHaveAttribute("data-state", "normal");
    await expect(nextOf(page), "重選不是作答").toBeHidden();
    await expect(progressOf(page)).toHaveText(progressText(1));
  });

  // 從平面圖頁的 fitLocked 測試（pan-zoom.spec.ts）搬過來的同一組步驟，入口換成找找看的「開始」。
  // 鎖住視野，題目才不會被「自己放大來找」破解；但兩段式是作答的機制本身，它的自動 3× 照常發生。
  test("出題期間擋得住使用者發起的縮放與拖曳，擋不住第一段的自動放大", async ({ page }) => {
    await startRound(page);
    const planGroup = planOf(page);
    const fit = (await planGroup.boundingBox())!;
    const center = { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 };

    await page.mouse.dblclick(blankSpot(fit).x, blankSpot(fit).y);
    expect((await planGroup.boundingBox())!.width, "雙擊放大應該被擋下").toBeCloseTo(fit.width, 0);

    await pinch(page, center, 100, 300);
    expect((await planGroup.boundingBox())!.width, "雙指放大應該被擋下").toBeCloseTo(fit.width, 0);

    const door = page.locator("#hs-door-entry");
    const before = (await door.boundingBox())!;
    await page.mouse.click(before.x + before.width + 13, before.y + before.height / 2);
    await expect(door).toHaveAttribute("data-state", "candidate");
    const zoomed = (await door.boundingBox())!;
    expect(zoomed.width, "第一段的自動 3× 不該被鎖定擋住").toBeGreaterThan(before.width * 2.5);

    // 拖曳在放大之後才問得出來：全圖時整張圖都看得到，拖不拖都不會動。
    const frame = (await viewportOf(page).boundingBox())!;
    await dragLeft(page, { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 }, 80);
    const dragged = (await door.boundingBox())!;
    expect(dragged.x, "鎖住視野時拖曳不該移動圖面").toBeCloseTo(zoomed.x, 0);

    // 第二段照樣確認得了：那一下就是作答。
    await page.mouse.click(dragged.x + dragged.width / 2, dragged.y + dragged.height / 2);
    await expect(statusOf(page)).toHaveText(/^答(對|錯)了。.+。$/);
  });

  // 鍵盤不走兩段式（票 06）：Enter 與 role="button" 一併要求的空白鍵直接選定熱區，那一下就是作答。
  test("鍵盤作答：Enter 與空白鍵選定熱區，判定與手指相同", async ({ page }) => {
    await startRound(page);

    await page.locator(`#${cleanHotspotsOf(await currentTarget(page))[0]}`).focus();
    await page.keyboard.press("Enter");
    await expect(statusOf(page)).toContainText("答對了。");
    await nextOf(page).click();

    await expect(progressOf(page)).toHaveText(progressText(2));
    await page.locator(`#${cleanHotspotsOf(otherThan(await currentTarget(page)))[0]}`).focus();
    await page.keyboard.press(" ");
    await expect(statusOf(page)).toContainText("答錯了。");
  });

  // 一局的進行狀態只在記憶體裡（spec「一局的流程」）：沒有續玩，也不跳離開確認。
  test("答到一半重新整理，回到開場", async ({ page }) => {
    await startRound(page);
    await answerByTwoTaps(page, cleanHotspotsOf(await currentTarget(page))[0]);
    await nextOf(page).click();
    await expect(progressOf(page)).toHaveText(progressText(2));

    await page.reload();

    await expect(page.getByRole("button", { name: "開始" })).toBeEnabled();
    await expect(progressOf(page)).toBeHidden();
  });
});

// 首次引導與平面圖頁共用同一句、同一個記錄（spec「首次引導」）：在哪一頁先看到都算看過。
test.describe("找找看頁的首次引導", () => {
  test("清空 localStorage 直接進找找看：第一題的狀態列說引導那一句", async ({ page }) => {
    await startRound(page);
    await hintDecided(page);
    await expect(statusOf(page)).toHaveText(TAP_HINT);
  });

  test("在平面圖頁看過引導，進找找看就不再說", async ({ page }) => {
    await page.goto(PLAN);
    await hintDecided(page);
    await expect(statusOf(page)).toContainText(TAP_HINT);

    await startRound(page);
    await hintDecided(page);
    await expect(statusOf(page)).not.toContainText(TAP_HINT);
  });
});
