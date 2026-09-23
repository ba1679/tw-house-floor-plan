"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ANALYTICS_EVENTS, analyticsSearchKey, analyticsSearchTerm, track } from "@/lib/analytics";
import { isEmptyQuery, searchSymbols } from "@/lib/symbols/search";
import type { SearchIndexEntry } from "@/lib/symbols/types";
import {
  CATEGORY_LABELS,
  searchAliasHint,
  searchLabel,
  searchNoResult,
  searchResultCount,
} from "@/lib/ui/copy";
import styles from "./SearchBox.module.css";

// 給「想查特定符號的人」的那條路：打幾個字，結果當場出現，不必在三張分類頁裡翻（spec user story 20）。
//
// **打的字對得到哪些符號不在這裡決定**，在 `lib/symbols/search.ts`——這個元件只負責把命中畫出來。
// 分開是因為 M4 的找找看要從同一份索引出題，也因為比對的風險是組合性的，要在 node 裡整批掃
// （tests/search-matching.spec.ts），瀏覽器只抽得了樣。
//
// **索引是 props，在 build 時就內嵌進頁面**：不 fetch、不打 API。也因此沒有 `/search` 路由——
// 全站是靜態輸出，產不出搜尋結果頁的 HTML，那一頁對搜尋引擎是空殼，卻仍然會被收錄。

export function SearchBox({ index, surface }: { index: SearchIndexEntry[]; surface: "home" | "category" }) {
  const inputId = useId();
  // 框裡的字與拿去比對的字是**兩份**：注音組字的時候，框裡暫時是「ㄢˋ」這種還沒選字的注音，
  // 它得照樣顯示，但不能拿去比對——否則狀態列會說「找不到符合『ㄢˋ』的符號」，受眾（PRD §3）
  // 每一次搜尋的第一個鍵都被回絕一次。選完字才算打完。
  const [inputValue, setInputValue] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const hits = searchSymbols(index, committedQuery);
  const sentQueries = useRef(new Set<string>());

  // The searchable UI is instantaneous, so an intentional search is the
  // settled query rather than a submit. Composition never updates
  // `committedQuery`, and the sanitizer never lets unknown text escape.
  useEffect(() => {
    const term = analyticsSearchTerm(index, committedQuery);
    if (!term) return;
    const key = `${surface}|${analyticsSearchKey(committedQuery)}`;
    if (sentQueries.current.has(key)) return;
    const timer = window.setTimeout(() => {
      sentQueries.current.add(key);
      track({
        name: ANALYTICS_EVENTS.search,
        search_term: term,
        result_count: hits.length,
        search_surface: surface,
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [committedQuery, hits.length, index, surface]);

  const status = isEmptyQuery(committedQuery)
    ? ""
    : hits.length === 0
      ? searchNoResult(committedQuery.trim())
      : searchResultCount(hits.length);

  return (
    <div className={styles.search} role="search">
      <label className={styles.label} htmlFor={inputId}>
        {searchLabel(index.length)}
      </label>
      <input
        id={inputId}
        className={styles.input}
        type="search"
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value);
          if (!(event.nativeEvent as InputEvent).isComposing) setCommittedQuery(event.target.value);
        }}
        // 兩條路都接，因為瀏覽器之間 `input` 與 `compositionend` 的先後不一。測試走得到的只有 Chromium
        // 那一種（選字的最後一次 `input` 仍帶著 `isComposing`，之後才來 `compositionend`）；
        // 先後反過來的瀏覽器，由「兩條路設的是同一個值」兜住。
        onCompositionEnd={(event) => setCommittedQuery(event.currentTarget.value)}
        autoComplete="off"
        spellCheck={false}
      />

      {/* 狀態列**一直在 DOM 裡**，只換裡面的字：live region 要先存在，後來換的字才會被唸出來。
          看得見的人讀得到「找不到」，讀螢幕的人不必把焦點移開輸入框也聽得到結果有幾個。 */}
      <p className={styles.status} role="status">
        {status}
      </p>

      {hits.length > 0 && (
        <ul className={styles.results}>
          {hits.map(({ symbol, matchedAlias }) => (
            <li key={symbol.id} className={styles.result}>
              {/* `prefetch={false}`：結果隨每一個字換一批，預設的「進入視野就預抓」會讓打字這件事
                  一路打網路——在接待中心的行動網路上，替讀者沒打算點的那幾個付流量。 */}
              <Link
                className={styles.link}
                href={`/symbols/${symbol.id}?from=search`}
                prefetch={false}
                onClick={() =>
                  track({
                    name: ANALYTICS_EVENTS.selectContent,
                    content_type: "search_result",
                    item_id: symbol.id,
                    origin_page_type: surface,
                  })
                }
              >
                <span className={styles.text}>
                  <span className={styles.name}>{symbol.name}</span>
                  {matchedAlias && (
                    <span className={styles.alias}>{searchAliasHint(matchedAlias)}</span>
                  )}
                </span>
                {/* 結果是三類混在一起的，說它屬於哪一類——搜尋索引帶著 `category` 就是為了這個。 */}
                <span className={styles.category}>{CATEGORY_LABELS[symbol.category].zh}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
