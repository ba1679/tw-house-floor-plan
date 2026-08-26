---
name: floorplan-generator
description: 由自然語言需求生成台灣住宅平面圖的結構化 JSON 與 SVG。當使用者要求「產生一個 25 坪兩房的平面圖」「畫一張三房兩廳」「把主臥放大 50cm」「加一個陽台」「把廚房改成開放式」，或需要為平面圖教學網站產生 layout 與 hotspot 資料時使用。輸出 FloorPlan JSON 為 source of truth，SVG 由 JSON 渲染而來。
---

# 平面圖生成器

## 這個 skill 的核心約定

**JSON 是唯一 source of truth。SVG 是它的一個投影，不是資料。**
任何時候都不要手改 SVG，也不要手改展開後的 `floorplan.json`——改 spec，重跑管線。

```
你寫 layout_spec.json      ← 拓樸 + 比例 + 語意
        ↓  expand_layout.py
   floorplan.json          ← 座標 / 牆 / 開口 / 熱區（確定性推導）
        ↓  validate_floorplan.py
   幾何與語意驗證           ← 有 error 就回頭改 spec
        ↓  render_svg.py
      plan.svg
```

**你只寫第一個檔案。** 座標、牆、門窗位置一律由程式推導——理由與規則見
`rules/geometry.md`，開工前務必先讀。

**傢俱位置也不是你寫的。** 你只說意圖（床靠北牆、電視對著沙發），展開器會避開
門的開啟弧線與開口兩側 60cm 通行空間去求解，必要時自動換一面牆並印出 `↻`。
這是為了避免一件事：寫 spec 的時候你看不到門窗最後落在哪裡，硬指定位置必然會撞。

## 工作流程

### 1. 解析需求 → 決定骨架

從使用者的話裡抽出：坪數、房數、衛浴數、特殊要求（開放式廚房／長型／某房要衣櫃…）。
沒講的用 `rules/rooms.md` 的預設值，**不要反問**，但要在回覆裡講清楚假設了什麼。

坪數預設當**權狀坪數**，公設比 0.32。這是最容易搞錯的一步。

### 2. 寫 layout_spec.json

照 `schema/layout_spec.schema.json`。最快的方式是挑一個最接近的範例改：

| 需求 | 從哪個範例開始 |
|---|---|
| 套房 / 1 房 | `examples/01-studio-12ping.json` |
| 2 房 | `examples/02-two-bed-20ping.json` |
| 2 房 2 衛 | `examples/03-two-bed-25ping.json` |
| 3 房 2 衛 | `examples/04-three-bed-35ping.json` |
| 長型 / 街屋 / 老公寓 | `examples/05-long-house-22ping.json` |

20 坪以上一律用「中央走道」結構（`rules/rooms.md` 的解法 A）——所有房間都與
`hallway` 相鄰，動線不會斷，共用邊也不會太短。這是失敗率最低的骨架。

### 3. 展開

```bash
python3 scripts/expand_layout.py my-spec.json -o out/my-plan.json
```

展開失敗時訊息會直接告訴你哪個門窗裝不上、為什麼。**那是要你改 spec。**

### 4. 驗證（不是選配）

```bash
python3 scripts/validate_floorplan.py out/my-plan.json --symbols data/symbols.sample.json
```

- **error 必須清零才算完成。** 不准為了消 error 而刪掉門或傢俱——
  刪門會讓房間走不到，刪傢俱是把「畫錯」換成「畫少」，兩者都只是把問題換一種形式。
- **「放不進」的正確修法有三招**，依序試：把門的 `at` 推到牆的一端 → 換小一點的傢俱
  → 調大該房的 `ratios`。錯誤訊息會列出每面牆還剩多少公分，照著它改。
- **warning 要判斷。** 暗房、臥室當通道、通行淨寬不足，有時就是該格局的真實缺點
  （長型街屋必然有暗房）。這種情況保留警告，並在回覆裡說明。

修 → 重跑 → 再驗，最多三輪。三輪還修不好，代表骨架選錯了，
回第 2 步換一個結構（通常是「該加走道了」）。

### 5. 渲染

```bash
python3 scripts/render_svg.py out/my-plan.json -o out/my-plan.svg
python3 scripts/render_svg.py out/my-plan.json -o out/debug.svg --show-hotspots
```

SVG 座標 = 世界座標（cm），靠 viewBox 縮放，所以 `hotspot.coords` 疊上去不需要任何換算。

### 6. 回報

告訴使用者：坪數換算假設、各房面積、剩下的 warning 代表什麼。
不要只丟一個檔案路徑。

## 硬規則

1. **不要自己發明 schema。** 欄位以 `schema/*.json` 為準。
2. **不要跳過驗證。** 「看起來對」不算數。
3. **不要手改 floorplan.json 或 SVG。** 一改就與 spec 脫鉤，下次重跑全部消失。
4. **不要用真實建案資料。** 全部是虛構示意圖。
5. **不要臆測符號對應。** 門窗熱區的 `symbol_id` 由 `rules/symbol_map.json` 決定，
   查不到就是 `null`，validator 只警告不擋。這對齊 PRD「20 是目標數量，不是預先鎖死的名稱」。
6. **公設比假設一定要講出來。** 它直接決定圖的大小。

## 與教學網站 PRD 的接點

`floorplan.json` 的 `hotspots` 與 PRD §7.3 的 `layout.hotspots` 同構
（`id` / `symbol_id` / `shape` / `coords` / `label_position`），可以直接餵給 viewer。

- 每一道門、每一扇窗**自動**產生一個熱區（`source: "auto_door"` / `"auto_window"`）
- 撒水頭、雨遮這類 CNS 符號用 spec 的 `hotspots` 手動標，`place` 可以相對房間下座標
- `symbol_id: null` 代表 M1 查證未完成，viewer 應略過

因此這個 skill 對 PRD 的用途是 **M2 的製圖工具**：快速試不同格局，驗證
「20 個符號塞不塞得進同一張圖」（PRD §12 列為未驗證風險），而不是另一條產品線。

## 驗收

`examples/` 的五份 spec 是回歸測試。改動任何 script 之後跑：

```bash
python3 scripts/run_examples.py
```

全部必須 0 errors。目前的基準：

| 範例 | 房 / 牆 / 門 / 窗 / 熱區 |
|---|---|
| 12 坪套房 | 4 / 7 / 4 / 4 / 11 |
| 20 坪兩房一廳一衛 | 7 / 10 / 7 / 6 / 18 |
| 25 坪兩房兩衛 | 8 / 11 / 8 / 7 / 22 |
| 35 坪三房兩衛 | 10 / 13 / 10 / 9 / 27 |
| 22 坪長型街屋 | 7 / 10 / 7 / 2 / 11 |

全部 0 errors。五份範例目前各有一個「大門不在圖面下方或右方」的 warning——那是製圖編排慣例
（見 `docs/reference/naid-symbols.md` §2.7）與本 skill「北方固定朝上」的座標系天生會打架，
不是 bug；要消掉得改切割樹讓玄關貼到南側或東側外牆。
長型街屋另外刻意保留 6 個 warning（暗房與穿越動線），那是該格局的真實缺點。
