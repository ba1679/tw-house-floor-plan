import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SymbolPageRecord, SymbolRecord } from "./types";

// Symbol（符號）是內容，與任何一張圖無關（CONTEXT.md）。資料在 build 時讀入，
// 執行期不打 API。前台看得見的字全部從這裡來——內容維護者改一次資料，
// 說明卡、符號頁、分類頁一起改（spec user story 34）。
//
// **一個模組，一個消費者一種形狀。** 投影的形狀由「這份資料要不要過網路」決定：
// 說明卡那一份會被序列化進靜態 HTML 當 props，所以逐欄挑；符號頁那一份是
// server component 直接渲染，挑得寬一點不必付運費。挑的動作留在這裡，
// 頁面拿到的就已經是它該有的形狀。

const SYMBOLS_FILE = join(process.cwd(), "data", "symbols.sample.json");

/**
 * 資料檔裡那一整批，**含查證欄位**（`verification_status`、`source_refs`、`_pilot_note`⋯）。
 * 型別只宣告投影會挑到的那幾欄，但執行期那一筆是完整的——所以這個函式**不匯出**，
 * 它的回傳值只能經由底下的投影出去，否則查證欄位就跟著上前台了。
 */
function readSymbolFile(): SymbolPageRecord[] {
  const { symbols } = JSON.parse(readFileSync(SYMBOLS_FILE, "utf8")) as {
    symbols: SymbolPageRecord[];
  };
  return symbols;
}

/**
 * 檢視器說明卡要的欄位。
 *
 * **逐欄挑出前台要的東西，不是把整筆丟出去。** 這份表會被當成 props 交給 client
 * 元件，也就是整筆會被序列化進靜態 HTML 裡；原封不動送出去等於把 `_pilot_note`
 * 這種內部備註、以及 `verification_status`（明講不上前台，CONTEXT.md）一起發佈，
 * 而且是 14 筆全帶著查證用的 `source_refs` 與 `ai_description`。
 */
function viewerFields(s: SymbolPageRecord): SymbolRecord {
  return {
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
  };
}

/** symbol id → 說明卡要的內容。找不到的 id 由呼叫端自己決定怎麼處理。 */
export function loadSymbolsForViewer(): Record<string, SymbolRecord> {
  return Object.fromEntries(readSymbolFile().map((s) => [s.id, viewerFields(s)]));
}

/**
 * symbol id → 符號頁與分類頁要的內容：說明卡那一份，再加這兩種頁面自己要的欄位。
 *
 * 疊在說明卡那一份上面，是因為兩者要的**內容**本來就是同一批字，差的只有隨頁面長出來的
 * 附加欄位。哪天說明卡因為 props 太重而拿掉某個欄位，而符號頁仍然要它，那一天這裡就得
 * 自己把它列出來——不要為了少打幾個字把頁面的需求綁在說明卡的運費決定上。
 */
export function loadSymbolsForPages(): Record<string, SymbolPageRecord> {
  return Object.fromEntries(
    readSymbolFile().map((s) => [s.id, { ...viewerFields(s), svg_ref: s.svg_ref }]),
  );
}
