import type { SourceRef } from "./types";
import { sourceLinkLabel, viaLabel } from "@/lib/ui/copy";

// 一筆出處在符號頁上印成什麼——**決定在這裡，畫在元件裡**。
//
// 分開的理由不是分層潔癖，是這裡的決定在真資料上驗不到：現況 15 筆 `source_refs`
// 沒有任何一筆有 `url`（缺的那兩筆屬於 M1），所以「有 url 就連得出去」那條路在
// 頁面測試裡永遠走不到。抽成純函式之後，fixture 走得到它，M1 補上 url 的那一天
// 連結自己長出來，不必回頭改元件也不必回頭補測試。
//
// 每一欄缺席都是安全的：少一欄就少印一行，**不是少印一筆來源**。讀者數得出來的
// 來源數必須等於我們實際查到的筆數，那正是這一區在做的事（PRD §6.5）。

/** 一筆出處**印在符號頁上的樣子**：四個部分，用不到的是 `null`——空字串會留一條看不見的空行。 */
export type PrintedSourceRef = {
  /** 文件名，永遠有。 */
  doc: string;
  /** 「去哪一頁看」：條次／頁碼與版本年併成一行。兩者都沒有時 `null`。 */
  locator: string | null;
  /** 轉載那一整行。不是轉載來的就 `null`。 */
  via: string | null;
  /** 連得出去的才有。公會規範永遠沒有——那是別人的著作，不連也不 host。 */
  link: { href: string; label: string } | null;
};

/** 條次／頁碼與版本年是同一件事的兩半：「去哪一份的哪一頁看」，所以併成一行。 */
function locatorOf(ref: SourceRef): string | null {
  const parts = [ref.clause, ref.year == null ? undefined : String(ref.year)];
  const joined = parts.filter((part): part is string => Boolean(part)).join(" · ");
  return joined || null;
}

/** 幾筆進來就是幾筆出去：內容維護者補第 2 個交叉來源之後，頁面自己多一行（PRD §9）。 */
export function printedSourceRefs(refs: SourceRef[]): PrintedSourceRef[] {
  return refs.map((ref) => ({
    doc: ref.doc,
    locator: locatorOf(ref),
    via: ref.via ? viaLabel(ref.via) : null,
    link: ref.url ? { href: ref.url, label: sourceLinkLabel(ref.doc) } : null,
  }));
}
