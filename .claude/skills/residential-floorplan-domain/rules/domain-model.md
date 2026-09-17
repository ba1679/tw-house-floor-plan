# Rule 1 - 先建立住宅空間 domain model
- Level: `MUST`
- 每個空間至少標記 `space_class`、`plumbing_dependency`、`ventilation_requirement`、`natural_light_requirement`、`door_requirement`、`circulation_requirement` 與 `maintenance_requirement`。
- `WET_AREA` 包含廚房、浴室、廁所、洗衣區；`SERVICE_AREA` 包含管道間、設備空間、結構柱與主要設備管線；其餘生活空間預設為 `DRY_AREA`。
- 管道間不可被當成普通房間，也不可只用面積與矩形重疊判斷其合理性。

## Good Example
```json
{"id":"bath-1","space_class":"WET_AREA","plumbing_dependency":"vertical_stack","ventilation_requirement":"exterior_window_or_mechanical_exhaust","maintenance_requirement":"accessible_for_fixture_and_pipe_maintenance"}
```

## Bad Example
```json
{"id":"bath-1","width":140,"height":220}
```

# Rule 2 - 先描述需求與關係，再做幾何排版
- Level: `MUST`
- 先建立 room list、adjacency graph、service dependencies 與 constraint levels，再交給 geometry generator。
- 不可從孤立矩形直接推論住宅合理；矩形不重疊只代表幾何條件成立。

## Good Example
```text
pipe_shaft -> bathroom -> bedroom/hallway
pipe_shaft -> kitchen -> dining
```

## Bad Example
```text
先把所有房間隨機塞進外框，再事後詢問浴室如何排水。
```

