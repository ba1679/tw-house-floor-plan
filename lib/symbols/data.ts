import { readFileSync } from "node:fs";
import { join } from "node:path";

// Symbol（符號）是內容，與任何一張圖無關（CONTEXT.md）。資料在 build 時讀入，
// 執行期不打 API。這裡只取檢視器現在真的會顯示的欄位——說明卡（票 03）會需要更多。

type SymbolRecord = { id: string; name: string };

const SYMBOLS_FILE = join(process.cwd(), "data", "symbols.sample.json");

/** symbol id → 給人看的名稱。熱區上顯示的字一律取自這裡，不在元件裡寫死。 */
export function loadSymbolNames(): Record<string, string> {
  const { symbols } = JSON.parse(readFileSync(SYMBOLS_FILE, "utf8")) as {
    symbols: SymbolRecord[];
  };
  return Object.fromEntries(symbols.map((s) => [s.id, s.name]));
}
