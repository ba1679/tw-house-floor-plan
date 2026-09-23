# 04: 內容入口、導覽與搜尋事件

**What to build:** 量到使用者從 header、首頁、分類、站內搜尋、符號頁轉換點與找找看入口怎麼移動；補齊符號頁的 `symbol_view`，並在不外送未知自由文字的前提下量站內搜尋。

**Blocked by:** 01、02

**Status:** resolved

規格：`../spec.md` 的「Analytics Decisions 1、3（symbol_view／select_content／search）」。

## 注意

- `select_content` 只量 spec 列出的八種產品入口，不要做全站 click listener。
- `item_id` 使用既有 layout／symbol／category id；`origin_page_type` 是固定 enum，不送完整 URL。
- 符號頁 `symbol_view` 每次頁面掛載一次，`surface = symbol_page`；React Strict Mode／hydration 不可雙送。
- 搜尋要等 composition 結束與 750ms idle；同一個 normalized query 每個 SearchBox 生命週期一次。
- 只有完整等於 name／alias 的白名單詞能成為 `search_term`；partial、無結果、email、電話與其他任意字串都送 `other`。
- 點搜尋結果同時是 `select_content: search_result`，不是第二次 `search`。

## Acceptance criteria

- [x] 八種入口各自送一次 `select_content`，payload 的 content type、item id、origin page type 正確
- [x] header 回首頁送 `header_home`；不影響導覽本身
- [x] 符號頁每次進入送一次且僅一次 `symbol_view: symbol_page`
- [x] IME 組字中不送 search；停 750ms 後才送，同 query 不重複
- [x] exact name／alias 可以送白名單詞；partial／unknown／email／電話只送 `other`
- [x] `result_count` 與首頁／分類頁的 `search_surface` 正確
- [x] 測試 sink 沒有任何完整 URL、referrer、未知 query 原文或 PII fixture
- [x] 既有搜尋匹配、SEO、導覽測試維持綠

## Comments

- All eight named entry points use the typed gateway. Symbol-page reads emit
  once per mount; the 750ms search debounce sends exact known names/aliases or
  `other`, never raw unknown input.
