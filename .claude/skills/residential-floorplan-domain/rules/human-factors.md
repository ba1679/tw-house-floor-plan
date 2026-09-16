# Rule 1 - 設備檢查必須包含使用與維修空間
- Level: `MUST`
- 每個 fixture 同時檢查本體 footprint、前方活動空間、側向空間、門／櫃門活動範圍、設備互撞、動線與維修空間。
- 「矩形沒有重疊」不足以判定浴室、廚房或臥室可用。

## Good Example
```text
bathroom = toilet footprint + front clearance + side clearance
          + sink clearance + shower entrance + door swing + maintenance access
```

## Bad Example
```text
PASS：馬桶、面盆、淋浴三個矩形沒有重疊。
```

# Rule 2 - 數值必須標示來源層級
- Level: `MUST`
- fixture 尺寸與 clearance 必須標記 `LEGAL`、`INDUSTRY_STANDARD`、`COMMON_PRACTICE`、`DESIGN_GUIDELINE` 或 `HEURISTIC`。
- 廠商建議尺寸可作設計參考，但不可未經查證直接當成台灣法定最低值。

## Good Example
```json
{"fixture":"shower","width_mm":900,"depth_mm":900,"knowledge_level":"DESIGN_GUIDELINE","source":[{"title":"HCG 衛浴空間規劃","url":"https://hcg.com.tw/tw/service/plan/space"}]}
```

## Bad Example
```json
{"fixture":"shower","minimum_mm":900,"knowledge_level":"LEGAL","source":[]}
```

