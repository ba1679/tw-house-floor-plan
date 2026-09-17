---
name: residential-floorplan-domain
description: 為台灣住宅平面圖生成與檢查提供住宅建築、濕區管線、空間鄰接、人體工學與錯誤案例 domain knowledge。當需要規劃、驗證或解釋住宅平面圖時使用；不取代 floorplan-generator 的幾何展開，也不產出可直接施工或申照的圖。
---

# 住宅平面圖 Domain Knowledge

這個 skill 將「什麼樣的住宅配置合理」與 `floorplan-generator` 的「如何展開與繪圖」分開。

# SOP

## Phase 1 -- 建立住宅配置模型

1. READ 讀取使用者需求、既有 layout spec 或 `floorplan.json`，確認坪數、房間、建築類型、樓層、外牆、結構柱與已知管道位置。
2. THINK 將空間分類為 `DRY_AREA`、`WET_AREA` 或 `SERVICE_AREA`，建立空間用途、設備、通風採光、維修與動線需求。
3. READ 若需要判斷分類、硬軟限制或安全邊界，讀取 `rules/domain-model.md` 與 `rules/constraint-severity.md`。

## Phase 2 -- 形成配置決策

1. READ 先讀取 `rules/reading-guide.md`，再依其情境路由讀取 `rules/space-adjacency.md`、`rules/plumbing.md` 或 `rules/human-factors.md` 等必要 domain rules；實際選擇以 reading guide 為準，不要無差別載入所有 rules。
2. THINK 先配置 Service Area 與 Wet Area，再建立 adjacency graph，最後才把 Dry Area、門窗、家具與動線納入幾何排版。
3. WRITE 若要交給 `floorplan-generator`，依 `schema/planning-brief.schema.json`、`templates/planning-brief.md` 與 `templates/planning-brief.example.md` 產出 planning brief；不要直接手寫展開後座標。

## Phase 3 -- 驗證與解釋

1. READ 依 `rules/human-factors.md` 確認方向與使用目標；若已知餐桌用餐側／淋浴入口，依 `schema/validation-context.schema.json` 提供 context，不可猜測缺漏。
2. DELEGATE 先跑 `floorplan-generator` 的 geometry validator；再從本 skill 目錄執行 `uv run scripts/validate_domain_rules.py --plan <floorplan.json> --rules knowledge/adjacency-rules.json --fixtures knowledge/fixture-dimensions.json --output <validation-report.json>`，有 context 時加 `--context <context.json>`。回傳 1 為概念配置需修改，2 為輸入錯誤；0 仍須讀取 unknown 與 warning，不表示合規。
3. THINK 區分 geometry error、概念設計 blocker、warning 與 preference；檢查 report.checks 的方向、實測值、採用目標和阻擋物，不把中心距離當實際管長或法律上限。
4. READ 若有不確定或來源衝突，讀取 `rules/source-hierarchy.md`，保留來源、版本、信心與適用範圍。
5. WRITE 依 `schema/validation-report.schema.json`、`templates/validation-report.md` 與 `templates/validation-report.example.md` 產出可讀報告；有 blocker 時回 Phase 2 修改 layout 後重新展開。無 blocker 但有未驗證項仍標 unknown；不得宣稱合規。

## Phase 4 -- 回歸檢查

1. DELEGATE 執行 `uv run python -m unittest discover -s tests -v`；`tests/fixtures/3b2l_before.floorplan.json` 固定原圖的 7 個淨空不足，測試同時檢查目前圖面、方向、單位、來源距離物件與 CLI 錯誤。`knowledge/bad-examples.json` 其餘案例是人工檢查清單，不得宣稱已全部自動化。
2. READ 回頭檢查所有新增規則是否有 `source`、`rule_type`、`confidence`、適用範圍與不確定性說明，且每個 module 都由本 SOP 回掛。

## 邊界

- `floorplan-generator` 負責 layout schema、slicing tree、座標、牆、門窗、家具展開與 SVG。
- 本 skill 負責住宅 domain 判斷、風險解釋、來源分級與再配置建議。
- 法規、結構、給排水、消防、電氣與施工結果仍需由合格專業人員依實案確認。
- 任何沒有可靠來源的數值只能標為 heuristic 或 design guideline，不得標成 legal hard constraint。
