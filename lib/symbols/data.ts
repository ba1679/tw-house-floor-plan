import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SymbolRecord } from "./types";

// Symbol（符號）是內容，與任何一張圖無關（CONTEXT.md）。資料在 build 時讀入，
// 執行期不打 API。頁面把整份表交給檢視器，說明卡要顯示的字全部從這裡來——
// 內容維護者改一次資料，四個介面一起改（spec user story 31）。

const SYMBOLS_FILE = join(process.cwd(), "data", "symbols.sample.json");

/** symbol id → 該符號的內容。找不到的 id 由呼叫端自己決定怎麼處理。 */
export function loadSymbols(): Record<string, SymbolRecord> {
  const { symbols } = JSON.parse(readFileSync(SYMBOLS_FILE, "utf8")) as {
    symbols: SymbolRecord[];
  };
  return Object.fromEntries(symbols.map((s) => [s.id, s]));
}
