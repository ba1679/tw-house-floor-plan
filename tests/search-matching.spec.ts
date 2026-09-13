import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { loadSearchIndex } from "@/lib/symbols/data";
import { searchSymbols } from "@/lib/symbols/search";
import type { SearchIndexEntry } from "@/lib/symbols/types";

// 搜尋打的字對得到哪些符號——spec「Testing Decisions」的 seam ③，**刻意破例**的那一條。
//
// M2 立過「不另外替純模組開單元測試」的規矩，理由是已知的 bug 都躲在螢幕 px 與圖面 cm 的
// 換算層。這個理由在搜尋上不成立：比對與版面尺寸無關，而它的風險是**組合性的**
// （46 個 aliases × 大小寫 × 全形半形 × 空白），瀏覽器測試只能抽樣，抽不到的那一組就是會出事的那一組。
// 所以這裡跑在 node context，不需要 `page` fixture，不新增框架也不改 config。
//
// **兩種索引，各問一種問題：**
// - **真的索引**（`loadSearchIndex()`，頁面內嵌的就是它）問組合性的風險：每一個名字與別名 × 每一種打法。
//   期望值從資料檔**原文**算。唯一寫死的是票面點名的「暗樑」與 `beam`——票面與 CONTEXT.md「樑」都說它們屬於樑。
// - **手寫的小索引**問規則本身：排序、資料那一側的全形字、空字串。這些規則不論資料長什麼樣都該成立，
//   而 M1 與 M3 並行、M1 動的正是資料檔（spec「Out of Scope」）：在真資料上寫死「打『樑』得到這三個」，
//   M1 替任何符號補一個含「樑」的別名，這裡就紅——壞的不是搜尋，是測試自己成了第二份會跟資料分岔的名單。
//
// 只問「對到哪些符號、什麼順序」，不問回傳值裡還帶了什麼（spec：不斷言函式回傳的物件形狀）。
// 別名對上時結果列上印什麼，是 `tests/search-box.spec.ts` 的事（seam ①）。

type RawSymbol = { id: string; name: string; aliases: string[] };

const symbols: RawSymbol[] = JSON.parse(readFileSync("data/symbols.sample.json", "utf8")).symbols;

/** 手寫的小索引。形狀照真資料裡的那幾筆抄，讀起來認得出在說哪件事，但不跟著資料變。 */
const sample: SearchIndexEntry[] = [
  { id: "column", name: "柱", aliases: ["柱子", "樑柱"], category: "structure" },
  { id: "beam", name: "樑", aliases: ["暗樑", "暗梁", "beam"], category: "structure" },
  { id: "pipe_shaft", name: "管道間", aliases: ["PS"], category: "structure" },
  { id: "entrance_opening", name: "出入口（無門扇）", aliases: ["過樑口"], category: "door_window" },
  { id: "door_sliding", name: "推拉門", aliases: ["拉門"], category: "door_window" },
];

/** 在這份索引裡打這串字，依序得到哪些符號。 */
const foundIn = (index: SearchIndexEntry[], query: string) =>
  searchSymbols(index, query).map((hit) => hit.symbol.id);

const found = (query: string) => foundIn(loadSearchIndex(), query);

test.describe("搜尋比對", () => {
  // 票面點名的兩個：一個是房產圈的俗稱（CONTEXT.md「樑」：製圖標準不分明樑暗樑，暗樑收在 aliases），
  // 一個是英文——兩者都不是正式名稱，而打這兩個字的人要找的都是同一個符號。
  test("打俗稱找得到正式名稱：「暗樑」與 beam 都找得到樑", () => {
    expect(found("暗樑")).toContain("beam");
    expect(found("beam")).toContain("beam");
  });

  // 「不必為了搜尋而小心翼翼地打字」（spec user story 22）。這幾個是**字面值**，每一個都是
  // 真的會發生的打法，也是底下那條掃描的錨：掃描裡的變體是測試自己生出來的，這裡的不是。
  test("大小寫、全形半形、前後空白都不影響結果", () => {
    expect(found("BEAM")).toContain("beam");
    // 注音輸入法切在全形英數時打出來的就是這個樣子。
    expect(found("ｂｅａｍ")).toContain("beam");
    expect(found("  暗樑 ")).toContain("beam");
    // 全形空白：中文輸入法下按空白鍵常常是它。
    expect(found("　暗樑　")).toContain("beam");

    // 資料裡寫大寫，打小寫的人也要找得到。
    expect(foundIn(sample, "ps")).toEqual(["pipe_shaft"]);
    // 反方向：**資料那一側**是全形。「出入口（無門扇）」的括號是全形，打半形括號的人也要找得到。
    expect(foundIn(sample, "出入口(無門扇)")).toEqual(["entrance_opening"]);
  });

  // 上面那條是抽樣，這條是票面說的組合性風險本身：每一個名字與別名 × 每一種打法。
  // 哪天 M1 補進一個帶英文的別名，它自動被掃到，不必回來加一行。
  test("每一個名字與別名，換成各種打法都找得到它的符號", () => {
    const toFullWidth = (text: string) =>
      text.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
    const toHalfWidth = (text: string) =>
      text.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    const typings = (text: string) => [
      text,
      text.toUpperCase(),
      text.toLowerCase(),
      toFullWidth(text),
      toFullWidth(text.toUpperCase()),
      toHalfWidth(text),
      ` ${text}  `,
      `　${text}　`,
    ];

    let checked = 0;
    for (const symbol of symbols) {
      for (const text of [symbol.name, ...symbol.aliases]) {
        for (const typed of typings(text)) {
          expect(found(typed), `打「${typed}」找不到 ${symbol.id}`).toContain(symbol.id);
          checked++;
        }
      }
    }
    // 掃描本身沒有空轉：資料被讀成空陣列的話，上面那一圈一次都不跑，而這條照樣是綠的。
    expect(checked).toBeGreaterThan(symbols.length * 8);
  });

  // 空字串是每一串字的子字串。不擋的話，在搜尋框裡按一下空白鍵，14 個符號就全部列出來——
  // 那不是搜尋結果，是分類頁已經列過的清單再印一次。
  test("什麼都沒打、或只打了空白，不算搜尋，一個都不列", () => {
    expect(found("")).toEqual([]);
    expect(found("   ")).toEqual([]);
    expect(found("　")).toEqual([]);
  });

  test("對不到任何符號的字，一個都不列", () => {
    expect(foundIn(sample, "游泳池")).toEqual([]);
  });

  // 打「樑」的人要找的是樑。照索引的先後，柱（別名「樑柱」）排在樑的前面——名字本身就對上的
  // 那一個，不該排在「只是別名裡剛好有這個字」的後面。
  test("名字對上的排在只有別名對上的前面，同一組裡照索引的先後", () => {
    // 樑是名字對上；柱與出入口是別名對上（「樑柱」「過樑口」），兩者之間照索引。
    expect(foundIn(sample, "樑")).toEqual(["beam", "column", "entrance_opening"]);
    // 兩個都是名字對上，照索引——排序只分兩組，不看名字多長、也不另外發明權重。
    expect(foundIn(sample, "門")).toEqual(["entrance_opening", "door_sliding"]);
  });

  // 暗樑、暗梁兩個別名都對上，樑也只是一個符號。
  test("同一個符號好幾個別名都對上，只列一次", () => {
    expect(foundIn(sample, "暗")).toEqual(["beam"]);
  });
});
