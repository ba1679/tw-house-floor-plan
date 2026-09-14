import { test, expect, type Page } from "@playwright/test";
import {
  QUIZ,
  answerByTwoTaps,
  cleanHotspotsOf,
  hotspotsOf,
  nextOf,
  plan,
  planOf,
  progressOf,
  progressText,
  startRound,
  startRoundAt,
  statusOf,
  symbolOf,
  symbols,
} from "./quiz-play";
import { blankSpot } from "./viewer-page";

// 作答之前不露名字（M4 票 03；spec「作答之前不露名字」、PRD §6.3.1）。
//
// 範圍是使用者感知得到的管道：讀螢幕念得出來的熱區替代文字、狀態列、熱區畫在圖上的 State。
// 熱區 id 照舊帶類型縮寫，要打開 DOM 才看得到，不在這裡測（票 03「注意」）。
//
// 「任何符號名字」拿資料裡**全部**的 `symbol.name` 去比，不只比題目那一個：
// 念出別的符號的名字，一樣是在替這一局後面幾題報答案的位置。

/** 字串裡出現了哪些符號名字。 */
const namesIn = (text: string) => symbols.map((s) => s.name).filter((name) => text.includes(name));

/** 中性標籤：spec 寫下的格式，再打一次字面值、不從程式 import——改了格式，讀螢幕使用者聽到的就變了。 */
const neutral = (room: string, k: number) => `${room} · 第 ${k} 個可以點的東西`;

/** 主圖上畫得出來的熱區數（`symbol_id` 為 null 的不畫）。拿來確認底下的迴圈真的走過整張圖。 */
const readableCount = plan.hotspots.filter((h) => h.symbol_id !== null).length;

type HotspotOnPage = { id: string; label: string; room: string; k: number; state: string | null };

/**
 * 圖上每一個熱區此刻念出來的是什麼，依 DOM 順序（＝ Tab 走的順序）。
 *
 * 房間與 k 問頁面自己：房間是分組的標籤（`data-room` 那一層），k 是它在那一組裡的位置。
 * 閱讀順序怎麼排不在測試裡再算一次（同 keyboard.spec.ts）。
 */
const hotspotsOnPage = (page: Page): Promise<HotspotOnPage[]> =>
  page.locator("#hotspot-layer [data-room]").evaluateAll((groups) =>
    groups.flatMap((group) =>
      [...group.querySelectorAll("rect")].map((el, index) => ({
        id: el.id,
        label: el.getAttribute("aria-label") ?? "",
        room: group.getAttribute("aria-label") ?? "",
        k: index + 1,
        state: el.getAttribute("data-state"),
      })),
    ),
  );

/**
 * 這個熱區的替代文字念出了哪些符號名字。
 *
 * 開頭的「房間名 · 」先拿掉再比：房間分組的標籤照舊（spec），而「管道間」同時是房間名與符號名——
 * 不拿掉的話，管道間那一格永遠被判成露了名字。只拿掉這個開頭：替代文字若整個就是「管道間」，照樣抓得到。
 */
const leakedNames = (h: HotspotOnPage) => {
  const prefix = `${h.room} · `;
  return namesIn(h.label.startsWith(prefix) ? h.label.slice(prefix.length) : h.label).map(
    (name) => `${h.id} 念出了「${name}」（${h.label}）`,
  );
};

/** 每一個熱區都念中性標籤、都沒有念出任何符號名字。 */
function expectAllNeutral(hotspots: HotspotOnPage[]) {
  expect(hotspots.length, "圖上沒有讀到熱區，底下的斷言等於沒跑").toBe(readableCount);
  expect(hotspots.map((h) => `${h.id}：${h.label}`)).toEqual(
    hotspots.map((h) => `${h.id}：${neutral(h.room, h.k)}`),
  );
  expect(hotspots.flatMap(leakedNames)).toEqual([]);
}

/**
 * 熱區身上除了位置、id、替代文字以外的每一個屬性。
 * 作答前每一個熱區都該一模一樣：題目熱區多帶一個不同的屬性，就是在圖上替答案做了記號——看不見的也算（spec）。
 */
const markingsOf = (page: Page) =>
  page.locator("#hotspot-layer rect").evaluateAll((els) =>
    els.map((el) =>
      el
        .getAttributeNames()
        .filter((name) => !["id", "x", "y", "width", "height", "aria-label"].includes(name))
        .map((name) => `${name}=${el.getAttribute(name)}`)
        .sort()
        .join(" "),
    ),
  );

async function expectNoNamesInStatus(page: Page, when: string) {
  const text = (await statusOf(page).textContent()) ?? "";
  expect(namesIn(text), `${when}，狀態列說的是「${text}」`).toEqual([]);
}

test.describe("作答之前", () => {
  test("每一個熱區念的是「房間名 · 第 k 個可以點的東西」，不念任何符號名字；也沒有熱區帶著區分得出答案的狀態", async ({
    page,
  }) => {
    await startRound(page);

    const hotspots = await hotspotsOnPage(page);
    expectAllNeutral(hotspots);
    // 讀螢幕實際念的是無障礙名稱，不是屬性本身：挑第一個確認兩者是同一句。
    const [first] = hotspots;
    await expect(page.locator(`#${first.id}`)).toHaveAccessibleName(neutral(first.room, 1));

    // 作答之前，題目的答案不是任何一種 State（CONTEXT.md）：沒有 revealed，也沒有先掛一個看不見的記號。
    expect([...new Set(hotspots.map((h) => h.state))]).toEqual(["normal"]);
    expect(new Set(await markingsOf(page)).size, "有熱區身上多帶了別人沒有的屬性").toBe(1);
  });

  test("第一段圈出候選、第二段沒點中、點到空白處：狀態列都不說任何符號名字", async ({ page }) => {
    await startRound(page);
    await expectNoNamesInStatus(page, "第一題剛出來");

    // 步驟照 quiz-page.spec.ts「都不算作答」那一條：點大門旁邊一點圈出候選，再離候選 50px 點第二下。
    const door = page.locator("#hs-door-entry");
    const start = (await door.boundingBox())!;
    await page.mouse.click(start.x + start.width + 13, start.y + start.height / 2);
    await expect(door).toHaveAttribute("data-state", "candidate");
    await expectNoNamesInStatus(page, "第一段圈出候選");
    // 候選是點的位置決定的，不是答案決定的；但圈出候選時也不該順便把答案標出來。
    await expect(page.locator('#hotspot-layer rect[data-state="revealed"]')).toHaveCount(0);

    const zoomed = (await door.boundingBox())!;
    await page.mouse.click(zoomed.x + zoomed.width + 50, zoomed.y + zoomed.height / 2);
    await expect(statusOf(page)).toContainText("還是沒點到");
    await expectNoNamesInStatus(page, "第二段沒點中");

    await page.getByRole("button", { name: "重選" }).click();
    await expect(door).toHaveAttribute("data-state", "normal");
    const fit = (await planOf(page).boundingBox())!;
    await page.mouse.click(blankSpot(fit).x, blankSpot(fit).y);
    await expect(statusOf(page)).toContainText("這附近沒有");
    await expectNoNamesInStatus(page, "點到空白處");

    await expect(nextOf(page), "上面這幾下都不是作答，後面的斷言問的都是作答之前").toBeHidden();
  });
});

test.describe("作答之後", () => {
  test("只有 selected 與 revealed 的熱區念符號名字，其餘照舊中性；按「下一題」全部回到中性", async ({ page }) => {
    const index = await startRoundAt(page, "window", { notLast: true });
    const [column] = cleanHotspotsOf("column");

    // 答錯：被點中的柱是 selected、窗的每一處是 revealed——兩個不同的符號都該念得出來。
    await answerByTwoTaps(page, column);

    const answered = await hotspotsOnPage(page);
    expect(answered.length).toBe(readableCount);
    const marked = answered.filter((h) => h.state === "selected" || h.state === "revealed");
    expect(marked.map((h) => h.id).sort()).toEqual([...hotspotsOf("window"), column].sort());

    // 答案已經交出去了：標出來的那幾個念名字，他聽得到自己點到的是柱、窗在哪幾處。
    const nameOfHotspot = (id: string) => symbolOf(plan.hotspots.find((h) => h.id === id)!.symbol_id!).name;
    expect(marked.map((h) => `${h.id}：${h.label}`)).toEqual(marked.map((h) => `${h.id}：${nameOfHotspot(h.id)}`));

    // 其餘的全部恢復成名字的話，Tab 一圈就知道這一局後面題目在哪（spec）。
    const rest = answered.filter((h) => !marked.includes(h));
    expect(rest.map((h) => `${h.id}：${h.label}`)).toEqual(rest.map((h) => `${h.id}：${neutral(h.room, h.k)}`));
    expect(rest.flatMap(leakedNames)).toEqual([]);

    await nextOf(page).click();
    await expect(progressOf(page)).toHaveText(progressText(index + 1));

    const next = await hotspotsOnPage(page);
    expectAllNeutral(next);
    expect([...new Set(next.map((h) => h.state))]).toEqual(["normal"]);
  });
});

// 找找看頁不掛網址高亮（spec「路由與頁面」）：高亮把一個符號的每一處同時圈亮，在這裡就是把答案畫在圖上。
// 對不到符號的 id 也一併走一次：「找不到網址指定的符號」只在那種網址上才有機會冒出來。
test("找找看頁網址帶 ?symbol=：不高亮任何熱區，也不說「找不到網址指定的符號」", async ({ page }) => {
  for (const symbol of ["window", "not-a-symbol"]) {
    await page.goto(`${QUIZ}?symbol=${symbol}`);
    await page.getByRole("button", { name: "開始" }).click();
    await expect(progressOf(page)).toHaveText(progressText(1));
    // 閘門：等 client 掛上圖、跑完掛載時的 effect。少了它，「沒有高亮」會在 effect 跑之前量到而通過。
    await expect(page.locator("#hotspot-layer")).toHaveAttribute("data-hint", /on|off/);

    await expect(page.locator('#hotspot-layer rect[data-state="highlighted"]'), symbol).toHaveCount(0);
    await expect(statusOf(page), symbol).not.toContainText("找不到網址指定的符號");
    await expectNoNamesInStatus(page, `網址帶 ?symbol=${symbol}`);
  }
});
