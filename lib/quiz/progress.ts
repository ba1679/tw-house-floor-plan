import { isCorrect, type Answer } from "./round";

// 學習進度（PRD §6.6、§6.6.1）：localStorage 裡 `fp:progress:v1` 那一份紀錄的形狀，以及怎麼讀它、怎麼記一筆作答。
//
// **純的**：不碰 localStorage。讀寫在 `components/progressStorage.ts`——與首次引導同一條分工，平台的東西留在 components。
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
