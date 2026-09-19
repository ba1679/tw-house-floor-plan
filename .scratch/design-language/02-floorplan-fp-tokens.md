# 02: 圖面層統一改用 `--fp-*` token

**What to build:** 讓 React 主平面圖與符號 sprite 共用 `--fp-*` 命名與定案色值，消除圖面 `--paper` 覆蓋介面 token 的撞名，並把房間底色改成只差明度的灰階。

**Blocked by:** None（可與票 03 並行）

**Status:** done

設計依據：根目錄 `DESIGN.md` 的「圖面」；值：`design/_tokens.txt` 的「圖面（`--fp-*`）」段。

## 範圍

- `components/FloorPlanRenderer.module.css` 內的圖面 token 全部改名為 `--fp-*`，名稱對齊 `data/symbols.sprite.svg` 已使用的變數。
- 圖紙維持純白；一般房間、濕區、陽台改成定案的無彩底色。
- 牆、柱、結構線、一般線與文字的鎖定明度關係不變，尤其柱必須比牆深。
- `--fp-muted` 改成 `#767676`，讓坪數、尺寸標註與比例尺副標對白底達到 4.5:1。
- 房間變暗維持 `color-mix(in oklab, <房間底色> 74%, #6b6b6b)`、160ms，並繼續尊重 `prefers-reduced-motion`。
- 更新失效或過時的 PALETTE 註解，使 `SymbolArt` 與主圖的共用關係說得準確。

## 不做

- 不動幾何、線寬、圖層順序、SVG 資料或 `lib/floorplan/drawing.ts`。
- 不改介面 token；由票 01 處理。
- 不改熱區狀態與圖上記號；由票 03 處理。

## Acceptance criteria

- [x] `FloorPlanRenderer.module.css` 不再宣告或讀取圖面用的 `--paper`、`--wall` 等無前綴名稱，全部改用 `--fp-*`
- [x] 主圖與 `data/symbols.sprite.svg` 的同名 token 具有同一組值
- [x] 一般房間、濕區、陽台都沒有色相；牆、柱與結構線的既有明度關係未改變
- [x] `--fp-muted` 對 `--fp-paper` 的文字對比至少 4.5:1
- [x] 說明卡開啟時的房間變暗與 reduced-motion 行為維持不變
- [x] 既有 renderer、符號圖與視野互動測試通過，並補足能防止 token 名稱與值再分岔的測試
- [x] `npm run typecheck`、`npm test` 通過


## Comments

**2026-09-19：做完了。** codex 實作，Claude 驗收並補註解。

- `FloorPlanRenderer.module.css` 的圖面 token 全部改讀 `--fp-*`，值集中在 `app/globals.css`；房間變暗改成每種房間各自的 `--fp-room-dim`（`color-mix(..., 74%, #6b6b6b)`），160ms 與 reduced-motion 不變。
- `data/symbols.sprite.svg` 的 fallback 對齊定案值（`--fp-room`、`--fp-muted`），`PS` 字的字體堆疊改成系統字。
- `tests/design-language.spec.ts` 守住：globals 的 `--fp-*` 值、renderer 讀的名稱、sprite fallback 同值、`--fp-muted` 對白 4.5:1。
- `components/SymbolArt.tsx` 過時的 PALETTE 註解已改寫。

備註：`.claude/skills/floorplan-generator/scripts/render_svg.py` 的 PALETTE 仍是舊色（`#f4f2ed` 等）。它是產生器的靜態產物，依 `docs/adr/0005` 可以與 React renderer 不同，不在本票範圍。
