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

# Rule 3 - 淨空量測與概念驗收必須分開
- Level: `MUST`
- 前方淨空從設備完整前緣，依 `facing` 向外量至房間 `inner` 或家具／柱的最近實體阻擋；用 cm 計算，參考表 mm 除以 10。旋轉 0/90/180/270 分別朝 s/e/n/w，矛盾資料視為輸入錯誤。
- 本專案自訂 HEURISTIC 目標：衣櫃站立、書桌座位區、床尾、沙發前方、浴缸長邊使用區 60 cm；廚具、冰箱前方 90 cm；指定餐桌用餐側 75 cm。這些是初版概念配置目標，不是法規、人體研究結論或適用所有人的保證。不得為讓圖面通過而偷偷降低門檻；特殊需求先重訂 brief。
- 廠商衛浴前方 60 cm 為 DESIGN_GUIDELINE。採用的目標不足時保留 SOFT_CONSTRAINT / warning，但設 `blocking=true` 要求修改概念圖，不把阻擋等同「違法」。
- 餐桌座位側與淋浴入口須由 `--context` 明確提供，不從正方形設備旋轉或桌面外形猜測。context 只是設計意圖，不是現場證據。
- 側向淨空、床側上下床、門／櫃門／椅子包絡、連續動線、維修及通風尚未自動驗證者列 `unknown`。使用區互相重疊不等同實體碰撞，仍須人工評估同時使用。

## Good Example
```text
衣櫃朝東，至床實測 8 cm < 專案站立目標 60 cm：blocking=true。
櫃門型式未知：另列 unknown，不宣稱櫃門可開。
```

## Bad Example
```text
把衣櫃門檻改成 8 cm 讓測試綠燈；或因中心距離不到 300 cm 就宣稱排水合規。
```
