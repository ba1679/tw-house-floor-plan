import { test, expect, type Page } from "@playwright/test";
import {
  LAYOUT_ID,
  PLAN,
  QUIZ,
  QUIZZABLE_COUNT,
  ROUND_SIZE,
  cleanHotspotsOf,
  currentTarget,
  nextOf,
  onPlan,
  otherThan,
  plan,
  playToResults,
  progressOf,
  progressText,
  seedProgress,
  startRound,
  symbolOf,
} from "./quiz-play";

// 開場與結算看得到你認得幾個（M4 票 05）。沒有獨立的進度頁：想知道自己還差什麼的那一刻，正是要開始玩的那一刻（PRD §11 #28）。
//
// 斷言看的是畫面上的字、清單的先後、連結去哪（spec「什麼是好的測試」）。熟悉度怎麼分層不在測試裡重算：
// 期望值從預塞的紀錄直接寫出來——哪幾個答對過、哪幾個錯了幾次。

const nameOf = (id: string) => symbolOf(id).name;
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 「這張三房兩廳你認得 N / 13」那一行。 */
const knownCountOf = (page: Page) => page.getByText(/你認得 \d+ \/ \d+/);
const knownCountText = (known: number) => `這張${plan.name}你認得 ${known} / ${QUIZZABLE_COUNT}`;

/** 開場的三份清單，以及結算的答錯清單，都以標題命名（`aria-labelledby`）。 */
const listOf = (page: Page, name: string | RegExp) => page.getByRole("list", { name });

/** 清單裡的名字，排好序：還沒遇到與已認識兩份只斷言集合，同一層裡的先後 spec 沒有規定。 */
const sortedItems = async (page: Page, name: string) =>
  (await listOf(page, name).getByRole("listitem").allTextContents()).map((text) => text.trim()).sort();
const sortedNames = (ids: string[]) => ids.map(nameOf).sort();

const blockLocalStorage = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });

const record = (correct: Record<string, number>, wrong: Record<string, number> = {}) => ({
  version: 1,
  layouts: { [LAYOUT_ID]: { correct, wrong } },
});
const allOnce = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 1]));

test.describe("開場", () => {
  test("預塞的進度：「你認得 N / 13」只數可出題符號；還不熟依錯誤次數由多到少、寫出次數；還沒遇到與已認識各自列出", async ({
    page,
  }) => {
    expect(onPlan, "主圖的可出題符號數與 QUIZZABLE_COUNT 對不上").toHaveLength(QUIZZABLE_COUNT);
    const known = onPlan.slice(0, 4);
    const [wrongOnce, wrongThrice, wrongTwice] = onPlan.slice(4, 7);
    const unseen = onPlan.slice(7);

    await seedProgress(
      page,
      record(
        // 樑與一個已經不在資料裡的 id 也答對過：紀錄裡有、但不是可出題符號的一律忽略，分子不能被它們灌大（spec「學習進度」）。
        { ...allOnce(known), beam: 2, retired_symbol: 1 },
        // 塞的順序刻意不是排好的。第一個已認識的也錯過 5 次：答對過一次就是已認識，不因為錯得多就排進還不熟。
        { [wrongOnce]: 1, [wrongThrice]: 3, [wrongTwice]: 2, [known[0]]: 5, retired_symbol: 4 },
      ),
    );
    await page.goto(QUIZ);

    await expect(knownCountOf(page)).toHaveText(knownCountText(known.length));

    // 使用者來這裡是想知道還差什麼：錯最多的在最前面，而且說得出錯了幾次。
    const row = (id: string, times: number) => new RegExp(`^\\s*${escapeRe(nameOf(id))}\\s*錯 ${times} 次\\s*$`);
    await expect(listOf(page, "還不熟").getByRole("listitem")).toHaveText([
      row(wrongThrice, 3),
      row(wrongTwice, 2),
      row(wrongOnce, 1),
    ]);

    // 「錯 N 次」與「還沒遇到」是兩種不熟，分在兩份清單裡。
    expect(await sortedItems(page, "還沒遇到")).toEqual(sortedNames(unseen));
    expect(await sortedItems(page, "已認識")).toEqual(sortedNames(known));
  });

  test("空的紀錄：0 / 13，13 個都在還沒遇到，沒有還不熟與已認識", async ({ page }) => {
    await page.goto(QUIZ);

    await expect(knownCountOf(page)).toHaveText(knownCountText(0));
    expect(await sortedItems(page, "還沒遇到")).toEqual(sortedNames(onPlan));
    await expect(listOf(page, "還不熟")).toHaveCount(0);
    await expect(listOf(page, "已認識")).toHaveCount(0);
  });

  // PRD §6.6：全部認得之後照樣可以玩，出題就在已認識的層裡隨機。
  test("13 / 13 全部認得：照樣可以按「開始」出第 1 題", async ({ page }) => {
    await seedProgress(page, record(allOnce(onPlan)));
    await page.goto(QUIZ);

    await expect(knownCountOf(page)).toHaveText(knownCountText(QUIZZABLE_COUNT));
    await expect(listOf(page, "已認識").getByRole("listitem")).toHaveCount(QUIZZABLE_COUNT);

    await page.getByRole("button", { name: "開始" }).click();
    await expect(progressOf(page)).toHaveText(progressText(1));
  });

  // 靜態 HTML 是每個人共用的同一份，而進度在瀏覽器裡。先印一個「0 / 13」再跳成真的數字，那一瞬間的 0 就是進度條在說謊（票面）。
  test("讀到進度之前不印數字：建置產出的 HTML 裡沒有「你認得」的分子，也沒有熟悉度清單；client 接手之後才出現", async ({
    page,
    request,
  }) => {
    const html = await (await request.get(QUIZ)).text();
    // 剝掉標籤再比：React 會在相鄰的文字之間插 `<!-- -->`，數字包在別的元素裡也一樣要抓得到。
    const text = html.replace(/<[^>]*>/g, "");
    expect(text, "靜態 HTML 先印了一個「你認得」的數字").not.toMatch(/你認得\s*\d/);
    expect(text, "靜態 HTML 先印了熟悉度清單").not.toContain("還沒遇到");

    // 閘門：同一個畫面在 client 接手之後量得到這兩樣，上面兩句才不是在量一個本來就不會出現的東西。
    await page.goto(QUIZ);
    await expect(knownCountOf(page)).toHaveText(knownCountText(0));
    await expect(listOf(page, "還沒遇到")).toBeVisible();
  });
});

test.describe("結算", () => {
  test("答對數 / 題數；答錯的每一列說你答成了什麼、連到題目的符號頁；「你認得」已經算進這一局", async ({ page }) => {
    // 6 個已認識 + 7 個還沒遇到：這一局一定是那 7 個（出題優先序，票 04）。答錯前 2 題、答對其餘 5 題 → 之後認得 6 + 5 = 11。
    const known = onPlan.slice(0, 6);
    await seedProgress(page, record(allOnce(known)));
    await page.goto(QUIZ);
    await expect(knownCountOf(page)).toHaveText(knownCountText(6));
    await page.getByRole("button", { name: "開始" }).click();

    const asked = await playToResults(page, { wrong: [1, 2] });

    await expect(page.getByText(`答對 ${ROUND_SIZE - 2} / ${ROUND_SIZE} 題`)).toBeVisible();

    // 答錯的符號「之後」會再出現，不承諾下一局：出題優先的是還沒遇到的（PRD §6.3）。
    const review = listOf(page, /之後會再出現/);
    const rows = review.getByRole("link");
    await expect(rows).toHaveText(
      asked.slice(0, 2).map((target) => `${nameOf(target)} · 你答成了${nameOf(otherThan(target))}`),
    );
    for (const [i, target] of asked.slice(0, 2).entries()) {
      await expect(rows.nth(i)).toHaveAttribute("href", `/symbols/${target}`);
    }

    // 寫進去之後的數字：這一局答對的 5 個已經算進去，答錯的 2 個還不算。
    await expect(knownCountOf(page)).toHaveText(knownCountText(11));

    await page.getByRole("link", { name: "回到平面圖" }).click();
    await expect(page).toHaveURL(PLAN);
  });

  test("點答錯清單的一列，到那個符號的符號頁", async ({ page }) => {
    await startRound(page);
    const [target] = await playToResults(page, { wrong: [1] });

    await listOf(page, /之後會再出現/).getByRole("link").click();

    await expect(page).toHaveURL(`/symbols/${target}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(nameOf(target));
  });

  // 依更新後的進度出題，由 quiz-progress.spec.ts「空白的紀錄連打兩局」釘住：第二局靠的就是這顆按鈕讀到第一局寫進去的紀錄。
  test("「再玩一次」回到第 1 題，結算畫面收起來", async ({ page }) => {
    await startRound(page);
    await playToResults(page);

    await page.getByRole("button", { name: "再玩一次" }).click();

    await expect(progressOf(page)).toHaveText(progressText(1));
    await expect(knownCountOf(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "回到平面圖" })).toHaveCount(0);
  });

  // 票 02 讓焦點跟著一局走（按下「下一題」落在新的題目上）。最後一題的「下一題」按下去，那顆按鈕就不在了——
  // 不接住的話焦點掉回頁面最開頭，讀螢幕的人聽不到成績。
  test("鍵盤：最後一題按「下一題」，焦點落在結算的成績上", async ({ page }) => {
    await startRound(page);
    for (let i = 1; i <= ROUND_SIZE; i++) {
      await expect(progressOf(page)).toHaveText(progressText(i));
      await page.locator(`#${cleanHotspotsOf(await currentTarget(page))[0]}`).focus();
      await page.keyboard.press("Enter");
      await expect(nextOf(page)).toBeFocused();
      await page.keyboard.press("Enter");
    }

    await expect(page.getByText(`答對 ${ROUND_SIZE} / ${ROUND_SIZE} 題`)).toBeFocused();
  });
});

// spec user story 42、PRD §6.3.3：localStorage 被封鎖時照樣可玩，只是不記——開場每次都是全部還沒遇到。封鎖的寫法同 affordance-hint.spec.ts。
test("瀏覽器封鎖 localStorage：開場與結算照樣顯示，都當成空紀錄", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await blockLocalStorage(page);

  await page.goto(QUIZ);
  await expect(knownCountOf(page)).toHaveText(knownCountText(0));
  expect(await sortedItems(page, "還沒遇到")).toEqual(sortedNames(onPlan));

  await page.getByRole("button", { name: "開始" }).click();
  await playToResults(page);
  await expect(page.getByText(`答對 ${ROUND_SIZE} / ${ROUND_SIZE} 題`)).toBeVisible();

  // 結算印的是讀得到的那一份——空的。這一局答對的 7 個沒有被記住，「再玩一次」出題依據的也是空紀錄；
  // 在這裡印 7 / 13，下一局卻又把它們當成還沒遇到來考，數字就與出題各說各話（票 05 的 Comments）。
  await expect(knownCountOf(page)).toHaveText(knownCountText(0));
  expect(errors).toEqual([]);
});
