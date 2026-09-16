# Rule 1 - 用鄰接偏好與避開關係描述空間組合
- Level: `MUST`
- 對每個重要空間記錄 `prefer_near`、`prefer_cluster_with`、`avoid` 與理由。
- 鄰接偏好不是絕對鄰接；若無法滿足，保留 warning、距離與替代方案，不要偷偷改變使用者需求。

## Good Example
```json
{"space":"kitchen","prefer_near":["pipe_shaft","dining_room"],"prefer_cluster_with":["laundry"],"avoid":["bedroom"],"reason":"縮短服務路徑並降低生活噪音干擾"}
```

## Bad Example
```json
{"space":"kitchen","must_touch":"pipe_shaft"}
```

# Rule 2 - 動線是關係圖的一部分
- Level: `SHOULD`
- 至少檢查玄關到客廳、客廳到臥室／衛浴、廚房到餐桌，以及主要家具之間的連續通行路徑。
- 不應把臥室當成通往其他主要空間的必要通道，除非報告明確標示這是既有格局限制或刻意示範的 bad case。

## Good Example
```text
entrance -> living -> hallway -> bedroom
                         └ bathroom
kitchen -> dining
```

## Bad Example
```text
entrance -> master_bedroom -> bathroom
```

