# Rule 1 - 先依情境選擇必要的 RuleFile
- Level: `MUST`
- 進入 domain reasoning 前，先依下表判斷情境，再讀取該情境的必要 rules；不要每次無差別載入所有 rules。
- `domain-model.md` 是建立或修改空間模型時的必要 rule；`constraint-severity.md` 是判定規則強度或輸出 finding 時的必要 rule；`source-hierarchy.md` 是使用外部資料、法規或處理衝突時的必要 rule。

| 情境 | 必要讀取 | 按需讀取 |
|---|---|---|
| 建立空間分類、設備依賴、服務區 | `domain-model.md` | `constraint-severity.md` |
| 規劃房間鄰接、公共／私領域、動線 | `domain-model.md`、`space-adjacency.md` | `constraint-severity.md` |
| 浴室、廚房、洗衣區、管道間 | `domain-model.md`、`plumbing.md` | `source-hierarchy.md`、`constraint-severity.md` |
| 衛浴設備、家具、門扇、使用空間 | `domain-model.md`、`human-factors.md` | `source-hierarchy.md`、`constraint-severity.md` |
| 通風、採光、法規條文 | `domain-model.md`、`source-hierarchy.md` | `constraint-severity.md` |
| 產出 validation report | `constraint-severity.md` | `source-hierarchy.md`（有外部來源或衝突時） |

## Good Example
```text
使用者要求「浴室離管道間太遠是否有問題」：
1. 讀 domain-model.md
2. 讀 plumbing.md
3. 讀 constraint-severity.md
4. 若需要引用法規或研究，再讀 source-hierarchy.md
```

## Bad Example
```text
使用者只要求調整客廳與餐廳的鄰接，卻只讀 human-factors.md，沒有讀 space-adjacency.md。
```

# Rule 2 - 按需讀取不能漏掉共同控制規則
- Level: `MUST`
- 只要要把判斷輸出成 error、warning、preference 或 unknown，就必須讀取 `constraint-severity.md`。
- 只要規則涉及法規、官方資料、研究報告、廠商資料或來源衝突，就必須讀取 `source-hierarchy.md`。
- 不可因為某個情境表列為「按需」就省略其實際已觸發的共同控制規則。

## Good Example
```text
讀到浴室至管道間距離超過偏好值：
- 讀 plumbing.md 判斷 plumbing risk
- 讀 constraint-severity.md 將結果標成 SOFT_CONSTRAINT / warning
- 讀 source-hierarchy.md 保留研究資料與查證狀態
```

## Bad Example
```text
看到「距離很遠」就直接輸出「違法」，不讀 constraint-severity.md，也不查 source-hierarchy.md。
```

# Rule 3 - 讀取順序應先模型、再 domain、最後治理
- Level: `SHOULD`
- 優先順序為：`domain-model.md` → 情境 domain rule → `constraint-severity.md` → `source-hierarchy.md`。
- 若使用者只要求解釋既有 finding，可從該 finding 的 category 開始，但仍需補讀它引用的 rule 與適用的治理 rule。

## Good Example
```text
human-factors 情境：domain-model.md → human-factors.md → constraint-severity.md → source-hierarchy.md（若有引用）
```

## Bad Example
```text
先讀一篇廠商尺寸文章，再反過來決定空間分類與規則強度。
```

