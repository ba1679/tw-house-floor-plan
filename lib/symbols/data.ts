import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SymbolRecord } from "./types";

// Symbol（符號）是內容，與任何一張圖無關（CONTEXT.md）。資料在 build 時讀入，
// 執行期不打 API。頁面把整份表交給檢視器，說明卡要顯示的字全部從這裡來——
// 內容維護者改一次資料，四個介面一起改（spec user story 31）。

const SYMBOLS_FILE = join(process.cwd(), "data", "symbols.sample.json");

/**
 * symbol id → 該符號的內容。找不到的 id 由呼叫端自己決定怎麼處理。
 *
 * **逐欄挑出前台要的東西，不是把整筆丟出去。** 這份表會被當成 props 交給 client
 * 元件，也就是整筆會被序列化進靜態 HTML 裡；原封不動送出去等於把 `_pilot_note`
 * 這種內部備註、以及 `verification_status`（明講不上前台，CONTEXT.md）一起發佈，
 * 而且是 14 筆全帶著查證用的 `source_refs` 與 `ai_description`。
 */
export function loadSymbols(): Record<string, SymbolRecord> {
  const { symbols } = JSON.parse(readFileSync(SYMBOLS_FILE, "utf8")) as {
    symbols: SymbolRecord[];
  };
  return Object.fromEntries(
    symbols.map((s) => [
      s.id,
      {
        id: s.id,
        name: s.name,
        category: s.category,
        plain_meaning: s.plain_meaning,
        caution: s.caution,
        source_tier: s.source_tier,
        confused_with: s.confused_with.map((c) => ({
          symbol_id: c.symbol_id,
          difference: c.difference,
        })),
      },
    ]),
  );
}
