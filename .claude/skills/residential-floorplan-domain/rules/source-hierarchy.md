# Rule 1 - 依來源權威排序並保留衝突
- Level: `MUST`
- Tier 1 優先使用台灣政府法規、內政部國土管理署與內政部建築研究所；Tier 2 使用專業機構與技術資料；Tier 3 使用公宅／社宅與真實住宅案例；Tier 4 使用專業文章；Tier 5 只能作待查線索。
- 不同來源衝突時保留兩筆原始資訊，標記 `conflict`，並採較高權威來源作暫時決策；不可自行平均或拼接成新規則。

## Good Example
```text
Tier 1 法規條文 -> 支撐 HARD_CONSTRAINT
Tier 3 公宅案例 -> 支撐 COMMON_PRACTICE
兩者不一致 -> 保留 conflict，交由專業確認
```

## Bad Example
```text
三篇裝修文章都這樣寫，所以把它升級為法規。
```

# Rule 2 - 每條規則都要能回溯
- Level: `MUST`
- `source` 至少包含 title、url、locator 或版本資訊；沒有來源的內容只能標 `confidence: low` 並標記 `needs_verification: true`。
- 法規資料保存查證日期，因為規範可能修正。

## Good Example
```json
{"source":[{"title":"建築物給水排水設備設計技術規範","url":"https://www.nlma.gov.tw/ch/legislation/regsearch/1487","version":"111.12.29 修正","checked_at":"2026-09-16"}],"confidence":"high"}
```

## Bad Example
```json
{"source":"官方規定","confidence":"high"}
```

