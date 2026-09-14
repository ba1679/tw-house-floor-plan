import { isCorrect, type Answer } from "./round";

// 學習進度（PRD §6.6、§6.6.1）：localStorage 裡 `fp:progress:v1` 那一份紀錄的形狀，以及怎麼讀它、怎麼記一筆作答。
//
// **純的**：不碰 localStorage。讀寫在 `components/useLearningProgress.ts`——與首次引導同一條分工，平台的東西留在 components。
// 出題（`pickQuestions`）只吃這裡的形狀，所以真資料做不出來的紀錄也測得到。

/** schema 版本。**不符時整份丟棄重來，不寫遷移**（PRD §6.6.1）：進度只存在單一裝置，本來就是可拋棄的資料。 */
const VERSION = 1;

/**
 * 一張圖上的紀錄：symbol id → 次數。
 * 存次數而不是布林值：「還不熟」要說得出錯了幾次，出題也要知道哪個錯得最多。
 */
export type LayoutProgress = {
  correct: Record<string, number>;
  wrong: Record<string, number>;
  updated_at?: string;
};

/** 整份紀錄。**以 layout 為單位**（PRD §6.6）：「這張圖你學完了」是一個合理的終點，全站加總則一個下午就滿了。 */
export type Progress = {
  version: typeof VERSION;
  layouts: Record<string, LayoutProgress>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 次數只收正的有限數字。這份資料住在使用者的瀏覽器裡，誰都改得到；
 * 一個字串或 NaN 混進次數，出題的排序就不再可預期。
 */
const counts = (value: unknown): Record<string, number> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0,
        ),
      )
    : {};

/**
 * 從 localStorage 讀到的字串 → 一份紀錄。沒有紀錄、壞掉的 JSON、版本不符，一律是空紀錄。
 */
export function parseProgress(raw: string | null): Progress {
  const empty: Progress = { version: VERSION, layouts: {} };
  if (raw === null) return empty;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!isRecord(data) || data.version !== VERSION || !isRecord(data.layouts)) return empty;

  const layouts: Record<string, LayoutProgress> = {};
  for (const [layoutId, layout] of Object.entries(data.layouts)) {
    if (!isRecord(layout)) continue;
    layouts[layoutId] = {
      correct: counts(layout.correct),
      wrong: counts(layout.wrong),
      updated_at: typeof layout.updated_at === "string" ? layout.updated_at : undefined,
    };
  }
  return { version: VERSION, layouts };
}

/** 次數表裡查一個 id。用 `Object.hasOwn`：`counts["constructor"]` 查得到 Object 原型上的東西。 */
const countOf = (table: Record<string, number>, symbolId: string) =>
  Object.hasOwn(table, symbolId) ? table[symbolId] : 0;

/** 一張圖的紀錄。這張圖還沒有任何紀錄時是空的。 */
export const layoutProgressOf = (progress: Progress, layoutId: string): LayoutProgress =>
  Object.hasOwn(progress.layouts, layoutId) ? progress.layouts[layoutId] : { correct: {}, wrong: {} };

/** 日期，照 PRD §6.6.1 的例子寫到日。用本地時間：台灣早上八點以前，UTC 還是昨天。 */
const localDate = (date: Date) =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");

/**
 * 記一筆作答（spec「學習進度」）：答對記在題目的 `correct`，答錯記在題目的 `wrong`。
 * **被點中的那個符號不記**——點歪不等於不認得（CONTEXT.md「熟悉度」）。
 */
export function recordAnswer(
  progress: Progress,
  layoutId: string,
  answer: Answer,
  now: Date,
): Progress {
  const layout = layoutProgressOf(progress, layoutId);
  const field = isCorrect(answer) ? "correct" : "wrong";
  return {
    ...progress,
    layouts: {
      ...progress.layouts,
      [layoutId]: {
        ...layout,
        [field]: { ...layout[field], [answer.target]: countOf(layout[field], answer.target) + 1 },
        updated_at: localDate(now),
      },
    },
  };
}

/**
 * 熟悉度（CONTEXT.md、PRD §6.6.1 的三態）：
 * - `known` 已認識：答對過至少一次——之後再錯幾次都還是認得
 * - `missed` 還不熟：沒答對過、答錯過
 * - `unseen` 還沒遇到
 *
 * **只由次數算，不另存欄位。**
 */
export type Familiarity = "known" | "missed" | "unseen";

export function familiarityOf(progress: LayoutProgress, symbolId: string): Familiarity {
  if (countOf(progress.correct, symbolId) > 0) return "known";
  return countOf(progress.wrong, symbolId) > 0 ? "missed" : "unseen";
}

/** 這個符號在這張圖上答錯過幾次。 */
export const wrongCount = (progress: LayoutProgress, symbolId: string) =>
  countOf(progress.wrong, symbolId);

/** 一串符號依熟悉度分成的三層。 */
export type FamiliarityTiers = Record<Familiarity, string[]>;

/**
 * 一串符號依熟悉度分成三層：`unseen` 還沒遇到、`missed` 還不熟（**錯最多的在前**）、`known` 已認識。
 *
 * **分層只有這一種算法。** 出題依層序填到題數（`pickQuestions`）、開場依層列出清單（M4 票 05），問的都是它——
 * 各寫一份，遲早有一邊的「還不熟」排法與另一邊不一樣，開場說你最該練的，出題卻不先考它（與 `quizzableSymbols` 同一條規矩）。
 *
 * 只走傳進來的 `symbolIds`、從不走紀錄：紀錄裡有、但不在其中的 id（樑、日後資料刪掉的符號）不會出現在任何一層，
 * 所以「你認得」的分子不會被它們灌大。
 *
 * 同一層裡的先後由 `arrange` 決定，**在依錯誤次數排序之前**套用：sort 是穩定的，錯誤次數相同的幾個就維持它排出來的先後。
 * 出題傳打亂（同數隨機），開場不傳（照 `symbolIds` 的先後）。三層依 unseen、missed、known 的順序各呼叫它一次——
 * 出題的打亂會消耗亂數，這個順序一換，同一組亂數序列出的題就跟著換。
 */
export function familiarityTiers(
  symbolIds: string[],
  progress: LayoutProgress,
  arrange: (ids: string[]) => string[] = (ids) => ids,
): FamiliarityTiers {
  const tier = (familiarity: Familiarity) =>
    arrange(symbolIds.filter((id) => familiarityOf(progress, id) === familiarity));

  const unseen = tier("unseen");
  const missed = tier("missed").sort((a, b) => wrongCount(progress, b) - wrongCount(progress, a));
  const known = tier("known");
  return { unseen, missed, known };
}
