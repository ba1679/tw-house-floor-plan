import { expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";

// 在瀏覽器裡玩找找看的測試共用的東西（M4）：資料、畫面上的定位、怎麼作答、怎麼決定這一局出哪幾題。
//
// 題目是隨機的，測試不猜：讀畫面上的題目文字（＝ `symbol.name`），用資料檔對回 symbol id，
// 再從 floorplan 資料找出它的熱區（spec「Testing Decisions」①）。命中怎麼算不在測試裡重算一次。

export type Hotspot = { id: string; symbol_id: string | null; coords: [number, number, number, number] };
type Floorplan = { id: string; name: string; hotspots: Hotspot[] };

export const floorplans: Floorplan[] = readdirSync("data/layouts")
  .filter((name) => name.endsWith(".floorplan.json"))
  .map((name) => JSON.parse(readFileSync(`data/layouts/${name}`, "utf8")));

export const symbols: {
  id: string;
  name: string;
  confused_with: { symbol_id: string; difference: string }[];
}[] = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")).symbols;

export const LAYOUT_ID = "3b2l_standard";
export const PLAN = `/layouts/${LAYOUT_ID}`;
export const QUIZ = `${PLAN}/quiz`;

/**
 * 主圖一局的題數。**spec 寫下的字面值**（13 個可出題符號 → 7 題），不拿 `roundSize` 算：
 * 用程式自己那條公式算期望值，公式錯了兩邊一起錯、一起過。主圖多一個有熱區的符號時，改這一行。
 */
export const ROUND_SIZE = 7;

/** 主圖的可出題符號數，也就是「你認得 N / M」的 M（PRD §6.6：13）。字面值，理由同 `ROUND_SIZE`。 */
export const QUIZZABLE_COUNT = 13;

export const plan = floorplans.find((fp) => fp.id === LAYOUT_ID)!;

/** 主圖上有熱區的符號，依第一次出現的順序（CONTEXT.md「可出題符號」的定義本身，不是出題的演算法）。 */
export const onPlan: string[] = [
  ...new Set(plan.hotspots.map((h) => h.symbol_id).filter((id): id is string => id !== null)),
];

export const idOfName = (name: string) => symbols.find((s) => s.name === name)?.id;
export const symbolOf = (id: string) => symbols.find((s) => s.id === id)!;

export const progressOf = (page: Page) => page.locator("#quiz-progress");
/** 題目裡的符號名字。題目文字是 `symbol.name` 原文（spec「一局的流程」），所以用名字就對得回資料。 */
export const questionNameOf = (page: Page) => page.locator("#quiz-question-name");
export const statusOf = (page: Page) => page.getByRole("status");
/** 作答之後前進的那一顆。最後一題按下去是結算，字照樣是「下一題」。 */
export const nextOf = (page: Page) => page.getByRole("button", { name: "下一題" });
export const planOf = (page: Page) => page.getByRole("group", { name: /三房兩廳/ });
export const viewportOf = (page: Page) => page.locator("#floorplan-viewport");

export const progressText = (index: number) => `第 ${index} / ${ROUND_SIZE} 題`;

/** 現在這一題的題目符號（symbol id）。 */
export const currentTarget = async (page: Page) =>
  idOfName((await questionNameOf(page).textContent())!)!;

export async function startRound(page: Page) {
  await page.goto(QUIZ);
  await page.getByRole("button", { name: "開始" }).click();
  await expect(progressOf(page)).toHaveText(progressText(1));
}

const centerOf = (h: Hotspot) => ({ x: h.coords[0] + h.coords[2] / 2, y: h.coords[1] + h.coords[3] / 2 });
const covers = (h: Hotspot, p: { x: number; y: number }) =>
  p.x >= h.coords[0] && p.x <= h.coords[0] + h.coords[2] && p.y >= h.coords[1] && p.y <= h.coords[1] + h.coords[3];

/** 這個符號在主圖上的每一處。 */
export const hotspotsOf = (symbolId: string) =>
  plan.hotspots.filter((h) => h.symbol_id === symbolId).map((h) => h.id);

/**
 * 這個符號在圖上、正中央**沒有疊著別的熱區**的每一處。
 *
 * 選這種熱區不是在測試裡重算命中：柱與窗重疊的地方選到的是柱（面積小者優先，two-stage-tap.spec.ts 測過），
 * 這裡要的是「點下去一定是它」的輸入，好讓斷言只問作答被判成什麼。
 */
export function cleanHotspotsOf(symbolId: string): string[] {
  const clean = plan.hotspots
    .filter((h) => h.symbol_id === symbolId)
    .filter((h) => plan.hotspots.every((o) => o === h || o.symbol_id === null || !covers(o, centerOf(h))))
    .map((h) => h.id);
  if (clean.length === 0) throw new Error(`${symbolId} 在圖上的每一處正中央都疊著別的熱區`);
  return clean;
}

/** 題目以外的另一個可出題符號——拿來答錯。 */
export const otherThan = (symbolId: string) => onPlan.find((id) => id !== symbolId)!;

/**
 * 用手指作答：點熱區正中央圈出候選並放大，再點一次放大後的正中央確認——那一下就是答案。
 * 放大之後同一個熱區換了螢幕座標，所以第二下之前重新量，不自己推算（同 `viewer-page.ts` 的 `selectByTwoTaps`）。
 * 不能直接用 `selectByTwoTaps`：作答之後被點中的熱區由一局標記，不在檢視器的 `selected` 裡。
 */
export async function answerByTwoTaps(page: Page, hotspotId: string) {
  const target = page.locator(`#${hotspotId}`);
  const before = (await target.boundingBox())!;
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
  await expect(target, `${hotspotId} 沒有被圈成候選`).toHaveAttribute("data-state", "candidate");
  const zoomed = (await target.boundingBox())!;
  await page.mouse.click(zoomed.x + zoomed.width / 2, zoomed.y + zoomed.height / 2);
  await expect(nextOf(page), "作答之後沒有出現「下一題」").toBeVisible();
}

/**
 * 從現在這一題玩到結算：每一題作答、按「下一題」。回傳依序出了哪幾題。
 * `wrong` 列出要答錯的題號（從 1 起）：點 `otherThan(題目)` 的熱區，所以答成了什麼由題目決定、測試算得出來。其餘答對。
 */
export async function playToResults(
  page: Page,
  { wrong = [] }: { wrong?: number[] } = {},
): Promise<string[]> {
  const asked: string[] = [];
  for (let i = 1; i <= ROUND_SIZE; i++) {
    await expect(progressOf(page)).toHaveText(progressText(i));
    const target = await currentTarget(page);
    asked.push(target);
    await answerByTwoTaps(page, cleanHotspotsOf(wrong.includes(i) ? otherThan(target) : target)[0]);
    await nextOf(page).click();
  }
  return asked;
}

/** localStorage 裡學習進度的 key（PRD §6.6.1）。再打一次字面值、不從程式 import：改了 key，每個人的舊紀錄就全部失效。 */
export const PROGRESS_KEY = "fp:progress:v1";

/**
 * 頁面載入之前先塞好一份學習進度。
 *
 * **只在 key 不存在時寫入**（spec「Testing Decisions」）：`addInitScript` 每一次導航都會重跑，
 * 無條件寫入的話，重新整理那一下會把 app 剛寫進去的紀錄蓋掉，「重新整理後紀錄還在」就測到假的結果。
 */
export async function seedProgress(page: Page, record: unknown) {
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [PROGRESS_KEY, JSON.stringify(record)] as const,
  );
}

/** localStorage 裡此刻的學習進度（沒有就是 null）。 */
export const storedProgress = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), PROGRESS_KEY);

/**
 * 開一局，並玩到題目是 `target` 為止：前面的題目都答對、按「下一題」。回傳它是第幾題。
 *
 * 「這一局一定有它」靠的是出題優先序（M4 票 04）：除了它以外，每一個可出題符號都先塞成已認識，
 * 它就是唯一一個還沒遇到的，一定排進這一局。
 *
 * `notLast`：要在它之後按「下一題」還看得到下一題的測試用。題序是整局打亂的，它若剛好排在最後一題，
 * 就重新整理、再開一局——它沒被作答，仍然是唯一還沒遇到的那一個。
 */
export async function startRoundAt(
  page: Page,
  target: string,
  { notLast = false }: { notLast?: boolean } = {},
): Promise<number> {
  const others = onPlan.filter((id) => id !== target);
  await seedProgress(page, {
    version: 1,
    layouts: { [LAYOUT_ID]: { correct: Object.fromEntries(others.map((id) => [id, 1])), wrong: {} } },
  });

  for (let attempt = 0; attempt < 10; attempt++) {
    await startRound(page);
    for (let i = 1; i <= ROUND_SIZE; i++) {
      await expect(progressOf(page)).toHaveText(progressText(i));
      const current = await currentTarget(page);
      if (current === target) {
        if (notLast && i === ROUND_SIZE) break;
        return i;
      }
      await answerByTwoTaps(page, cleanHotspotsOf(current)[0]);
      await nextOf(page).click();
    }
  }
  throw new Error(`開了 10 局都沒有在最後一題之前出到 ${target}：出題優先序沒有把唯一還沒遇到的符號排進來`);
}
