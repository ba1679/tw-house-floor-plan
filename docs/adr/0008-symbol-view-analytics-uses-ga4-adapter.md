---
status: accepted
date: 2026-09-20
---

# 用 GA4 adapter 記錄真正呈現出的 `symbol_view`

M5 只記錄使用者真正看到 symbol 解釋內容的極簡 Analytics 事件：自由看圖與找找看在說明卡成功打開時記錄，符號頁在內容成功載入時記錄；同一次呈現只記一次。事件透過薄的 GA4 adapter 送出，不把 Analytics provider 的 API 形狀散落在頁面與檢視器裡。

事件不帶姓名、帳號、自由文字或學習進度明細，只保留 `symbol_id`、入口來源（`layout` / `search` / `quiz` / `category`），以及平面圖入口可用的 `layout_id` 與 `hotspot_id`；`layout_id` 在 `layout` / `quiz` 必填。找找看答錯時，`symbol_id` 是實際打開說明的題目 symbol，`hotspot_id` 是觸發這次說明的實際被點中熱區，兩者可以指向不同 symbol；分析端需要時由 floorplan 資料還原熱區指向，不另送 `picked_symbol_id`。

符號頁由搜尋或分類進入時，用 `?from=search` / `?from=category` 明確帶入入口來源，頁面的 canonical 仍指向不含 query 的乾淨 URL。

## Considered Options

- **頁面載入或點擊就記錄**：拒絕，因為那會把「有互動」誤當成「開始理解」，也會把尚未成功顯示說明的操作算進來。
- **把 GA4 呼叫直接寫在各頁面與元件**：拒絕，因為日後更換 provider 會同時改動符號頁、檢視器與找找看。
