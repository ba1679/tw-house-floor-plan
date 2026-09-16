# Rule 1 - 濕區與垂直管線優先形成可維護群組
- Level: `SHOULD`
- 優先讓浴室、廁所、廚房、洗衣區靠近同一服務核心或合理的垂直管道系統。
- 檢查的不只是直線距離，也要注意管線是否穿越大量乾區、是否需要不合理的水平排水路徑，以及是否保留檢修可能性。
- 「離管道間遠」是高風險 warning，不在沒有實案資料時直接判定違法。

## Good Example
```text
pipe_shaft ─ bathroom ─ bedroom/hallway
          └ kitchen ─ dining
```

## Bad Example
```text
pipe_shaft ─ bedroom ─ living ─ kitchen ─ bathroom
```

# Rule 2 - 法規來源與設計推論不可混寫
- Level: `MUST`
- 《建築物給水排水設備設計技術規範》與《建築技術規則》可支撐法規或技術規範層級；研究報告與設計指引可支撐設計建議，但不能自動升級為法律硬限制。
- 每條 plumbing rule 保留來源 URL、文件名稱、版本／修正日期、條文或頁碼與 `confidence`。

## Good Example
```json
{"rule_type":"SOFT_CONSTRAINT","source":[{"title":"建築物同層排水系統設計指引","url":"https://www.abri.gov.tw/PeriodicalDetail.aspx?isShowAll=false&key=111&n=861&s=2899","locator":"研究與指引摘要"}],"confidence":"medium"}
```

## Bad Example
```json
{"rule_type":"HARD_CONSTRAINT","source":"網路文章","description":"浴室一定要貼著管道間。"}
```

