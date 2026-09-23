import { isEmptyQuery } from "@/lib/symbols/search";
import type { SearchIndexEntry } from "@/lib/symbols/types";

/** Never return a raw unknown query to an analytics caller. */
export function analyticsSearchTerm(index: SearchIndexEntry[], query: string): string | null {
  if (isEmptyQuery(query)) return null;
  const normalized = normalize(query);
  for (const symbol of index) {
    for (const term of [symbol.name, ...symbol.aliases]) {
      if (normalize(term) === normalized) return term;
    }
  }
  return "other";
}

/** The same normalization used for the per-SearchBox duplicate guard. */
export function analyticsSearchKey(query: string): string {
  return normalize(query);
}

function normalize(text: string): string {
  return text
    .replace(/[！-～]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .toLowerCase()
    .trim();
}
