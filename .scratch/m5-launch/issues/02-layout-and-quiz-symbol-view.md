# 02: 自由看圖與找找看的 `symbol_view`

**What to build:** 讓自由看圖與找找看的使用者只有在真正看到 InfoSheet 解釋時才被計為一次符號瀏覽，並讓站長能由事件重建是哪張 FloorPlan、哪個 Hotspot 觸發這次閱讀。

**Blocked by:** 01 / GA4、Consent Mode 與 Symbol 頁事件

**Status:** ready-for-agent

- [ ] 自由看圖只在 InfoSheet 成功呈現時送 `source=layout`；第一段候選、點空白、第二段未命中、網址高亮與缺席橫幅都不送
- [ ] 自由看圖事件包含正確的 `layout_id`、被閱讀的 `symbol_id` 與實際 `hotspot_id`
- [ ] 找找看答對後不自動送事件；使用者按「看說明」並成功開卡後才送 `source=quiz`
- [ ] 找找看答錯、自動打開題目 InfoSheet 時送一筆事件
- [ ] 找找看答錯事件的 `symbol_id` 是題目 Symbol，`hotspot_id` 是實際被選定 Hotspot；兩者可以指向不同 Symbol
- [ ] 不新增 `picked_symbol_id`；需要的被點 Symbol 可由 `layout_id + hotspot_id` 回查 FloorPlan
- [ ] 同一次卡片呈現只送一次；展開、resize、切換 occurrence 或 React 重繪不重送
- [ ] 關閉 InfoSheet 後再次打開同一個 Symbol 視為新的呈現，可以再送一筆
- [ ] Analytics 判斷留在知道完整情境的自由看圖／找找看父層，共用 InfoSheet 不負責推測 `source`
- [ ] 真瀏覽器案例同時覆蓋不應送、應送、去重、重開，以及找找看答錯的 Symbol／Hotspot 不一致情境
