import type { SearchIndexEntry } from "./types";

// 打的字對得到哪些符號——**決定在這裡，畫在搜尋框裡**。
//
// 這個檔案不碰 DOM、不讀檔：搜尋框在瀏覽器裡呼叫它，M4 的找找看要從同一份索引出題，
// 測試在 node 裡直接問它（tests/search-matching.spec.ts）。

/** 一筆命中。 */
export type SearchHit = {
  symbol: SearchIndexEntry;
  /**
   * 只有別名對上時，是哪一個別名：結果列要印出來說明為什麼是它（`searchAliasHint`）。
   * **資料裡的原文**，不是正規化之後的樣子；名字本身就對上時是 `null`；
   * 好幾個別名都對上時，是資料檔裡排前面的那一個。
   */
  matchedAlias: string | null;
};

/**
 * 把「同一串字的不同打法」收成同一個樣子。**只做三件事**：全形轉半形、大小寫、前後空白。
 *
 * - **全形轉半形只轉全形 ASCII 那一段**（U+FF01–FF5E）與全形空白（U+3000），不用 `normalize("NFKC")`：
 *   NFKC 會多做很多事——相容漢字併進正規漢字、上標數字變一般數字、「㎡」拆成「m2」——每一件都會讓
 *   「打這個為什麼找到那個」變得難以預測，而那正是票面要避開的。
 * - **不做簡繁轉換**：受眾是台灣人（PRD §3），多一張對照表要維護，比對結果也跟著難以預測。
 * - 中間的空白不動：「坐式 馬桶」不是「坐式馬桶」的另一種打法，是另一串字。
 *
 * 兩側都過一次——打的字與索引裡的字。資料那一側也會有全形字（「出入口（無門扇）」的括號）。
 */
function normalize(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * 這串字算不算「還沒打」：正規化之後什麼都不剩（只打了空白也算，全形空白也是）。
 *
 * `searchSymbols` 對「還沒打」與「打了但沒有命中」都回空陣列，而搜尋框要分開這兩件事——前者什麼都不說，
 * 後者要說找不到。判斷放在這裡，是讓「什麼算空」與比對用的是同一套正規化，不在兩邊各寫一份。
 */
export function isEmptyQuery(query: string): boolean {
  return normalize(query) === "";
}

/**
 * 名字或任何一個別名裡含有打的字，就算命中。
 *
 * 什麼都沒打時一個都不列：空字串是每一串字的子字串，不擋的話按一下空白鍵就把 14 個全部列出來。
 *
 * **排序只分兩組**：名字對上的在前，只有別名對上的在後，組內照索引（也就是資料檔）的先後。
 * 打「樑」的人要找的是樑，而照資料檔的先後，別名「樑柱」會讓柱排在樑前面。
 * 不另外發明一套權重——14 筆的清單用不到，而權重是一個過幾個月沒有人說得出來由的編輯決定。
 */
export function searchSymbols(index: SearchIndexEntry[], query: string): SearchHit[] {
  if (isEmptyQuery(query)) return [];
  const typed = normalize(query);

  const byName: SearchHit[] = [];
  const byAlias: SearchHit[] = [];
  for (const symbol of index) {
    if (normalize(symbol.name).includes(typed)) {
      byName.push({ symbol, matchedAlias: null });
      continue;
    }
    const alias = symbol.aliases.find((text) => normalize(text).includes(typed));
    if (alias !== undefined) byAlias.push({ symbol, matchedAlias: alias });
  }
  return [...byName, ...byAlias];
}
