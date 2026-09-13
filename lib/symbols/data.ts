import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SymbolCategory, SymbolPageRecord, SymbolRecord } from "./types";

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
 *
 * `source_refs` **整批帶過去，不像 `confused_with` 那樣逐欄挑**：逐欄挑是為了控制序列化進
 * HTML 的重量，而這一份不過網路。抄一份欄位清單反而是負債——`SourceRef` 四欄選填，
 * 將來多一欄漏抄，TypeScript 不會出聲，那一欄就從符號頁上靜靜消失。
 */
export function loadSymbolsForPages(): Record<string, SymbolPageRecord> {
  return Object.fromEntries(
    readSymbolFile().map((s) => [
      s.id,
      { ...viewerFields(s), svg_ref: s.svg_ref, source_refs: s.source_refs },
    ]),
  );
}

/** 一張分類頁的內容：它是哪一類，以及該類底下有哪些符號。 */
export type SymbolCategoryPage = {
  id: SymbolCategory;
  symbols: SymbolPageRecord[];
};

/**
 * 站上有哪些分類，以及每一類底下有哪些符號。
 *
 * **不是投影，是一個由投影算出來的分組**——形狀仍然由消費者決定（分類頁要的是「一類一串」
 * 而不是「id → 符號」），但欄位沿用符號頁那一份：兩種頁面顯示的是同一批字，差別只在
 * 一次顯示幾個。
 *
 * **分類清單由資料算出，不寫死。** 掃過每個符號的 `category`，出現過的才算一類——今天是
 * 3 類。另外手寫一份「就這 3 類」的常數會變成第二份會跟資料分岔的名單，正是 PRD §9
 * 「不得各自維護副本」要防的事；而沒有符號的分類**不該有頁面**：`plumbing_electric` 與
 * `fire_safety` 在 v0.4 被砍出範圍（PRD §4.1），替它們留一張「此分類階段一尚未收錄」
 * 對讀者沒有價值，Google 則會把它當 thin content，連帶拖累整站。
 *
 * **少一個分類的中文名就編譯失敗**——這是那條建置檢查的 TypeScript 半邊，而它**住在
 * `lib/ui/copy.ts` 的 `CATEGORY_LABELS` 那一行型別註記上**（以 `SymbolCategory` 為 key 的
 * `Record`）：少一個 key，錯誤就報在那份常數的定義處，與有沒有人查它、用什麼型別的 key 查都無關。
 * 另一半是「資料裡的分類合不合法」，由 `scripts/validate_data.py` 顧著——它是 Python，讀不到
 * 這邊的常數，兩半因此各自用看得到事實的語言把關，而不是在兩邊各抄一份中文名。
 *
 * `id` 的型別是 `SymbolCategory` 而不是 `string`，買到的是比較小的一件事：分類頁查
 * `CATEGORY_LABELS` 時不必把網址字串 `as SymbolCategory` 硬轉。硬轉弄不掉上面那道編譯保證，
 * 但它是一句編譯器檢查不了的斷言；從這裡拿到的 id 則一定出自資料，而資料裡的分類驗證器已經擋過。
 *
 * **順序照資料檔**：分類之間、以及一類之內的符號都是。另外排一套等於在資料之外再做一個
 * 編輯決定，而那個決定過幾個月沒有人記得寫在哪裡；要換順序就換資料檔裡的順序。
 */
export function loadCategories(): SymbolCategoryPage[] {
  const grouped = new Map<SymbolCategory, SymbolPageRecord[]>();

  for (const symbol of Object.values(loadSymbolsForPages())) {
    const listed = grouped.get(symbol.category);
    if (listed) listed.push(symbol);
    else grouped.set(symbol.category, [symbol]);
  }

  return [...grouped].map(([id, symbols]) => ({ id, symbols }));
}
