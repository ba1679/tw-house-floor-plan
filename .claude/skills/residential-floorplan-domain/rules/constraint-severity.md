# Rule 1 - 明確區分規則強度
- Level: `MUST`
- `HARD_CONSTRAINT` 只用於法規或資料明確要求、結構不可變、設備無法放置、門無法開啟或基本通行不成立的情況。
- `SOFT_CONSTRAINT` 用於管線距離、濕區集中、動線長度、收納與配置效率；違反時產生 warning 或降低評分。
- `DESIGN_PREFERENCE` 用於採光較佳、安靜、公私分區與視覺隱私；不得當成法律要求。

## Good Example
```json
{"rule_type":"SOFT_CONSTRAINT","severity":"warning","description":"浴室距離管道間較遠，需檢查排水路徑與坡度。"}
```

## Bad Example
```json
{"rule_type":"HARD_CONSTRAINT","description":"浴室最好靠近管道間。"}
```

# Rule 2 - 不確定時降低信心並提出確認事項
- Level: `MUST`
- 無法由平面資料判定樓板、管徑、排水坡度、通風設備或結構時，標記 `uncertain`，不得輸出「已合規」。
- 報告需說明需要確認的實體資料與建議諮詢的專業角色。

## Good Example
```text
WARNING [medium] 衛浴至管道間約 4.8m；實際可行性取決於樓板降板、坡度、管徑與立管位置，請由建築／機電專業確認。
```

## Bad Example
```text
PASS：所有排水都一定可施工。
```

