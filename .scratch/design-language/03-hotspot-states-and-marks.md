# 03: 套用熱區狀態與圖上記號

**What to build:** 把 `normal`、`candidate`、`selected`、`highlighted`、`revealed`、候選圈、答對勾與鍵盤焦點改成票 09 定案的狀態系統；灰階下靠形狀與密度仍分得出來。

**Blocked by:** None（可與票 02 並行）

**Status:** ready

設計依據：根目錄 `DESIGN.md` 的「狀態」與「熱區」；值：`design/_tokens.txt` 的「熱區狀態與圖上記號」段。

## 範圍

- 在 `components/FloorPlanViewer.module.css` 套用 `--state-*` 與 `--mark-*` token：藍色表示使用者操作、暖色表示系統標示。
- 狀態填色以 `mix-blend-mode: multiply` 疊圖；狀態線畫在熱區外側，不遮住熱區內的窗、門等符號線。
- `selected` 使用完整粗框、填色與白襯邊；`revealed` 改成四角 L 形角標與白襯邊，不再使用紫色虛線。
- 候選圈改為藍色實線，不再與門扇軌跡共用虛線語彙。
- 找找看答對時，在被選中的熱區右上外側畫墨色粗勾與白襯邊；位置需避開焦點環。答錯時不畫勾。
- 熱區鍵盤焦點改成離邊緣 3px 起畫的白／黑／白雙環，蓋在所有 State 與記號上。
- 更新 `tests/quiz-feedback.spec.ts` 等只認舊虛線畫法的斷言，改驗證定案後的形狀、疊放與語意。
- 新增 node-context 對比測試，直接讀 CSS，驗證藍線、暖線與答對勾對 `--fp-paper`、`--fp-wall` 都至少 3:1。

## 不做

- 不改 State 的生命週期、命中判定、兩段式放大、ARIA 名稱或答題規則。
- 不改一般介面控制項的樣式；由票 01 處理。
- 不改圖面底色與結構色；由票 02 處理。

## Acceptance criteria

- [x] 五種熱區 State、候選圈、答對勾與焦點環皆使用有語意名稱的 token，不再散落匿名 oklch 值
- [x] `revealed` 與候選圈沒有 `stroke-dasharray`；門扇軌跡仍保留圖面既有虛線
- [x] `selected` 與 `revealed` 在灰階下可由完整框／填色和四角角標分辨，不只靠色相
- [ ] 狀態線在熱區外側、填色使用 multiply，不遮淡符號線；白襯邊只給 `selected`、`revealed` 與答對勾
- [x] 答對勾只在答對的 `selected` 出現，位於右上外側且不與焦點環重疊；答錯不出現
- [x] 藍線、暖線與答對勾對 `--fp-paper`、`--fp-wall` 都達 3:1，並由測試守住
- [x] 焦點雙環疊在每一種 State 上仍清楚，兩色彼此至少 9:1
- [x] `npm run typecheck`、`npm test` 通過


## Comments

**2026-09-19：做了大半，還沒完成。** 前半由 codex 實作，Claude 修掉單位錯誤並改了答對勾的位置。

### 已完成

- `--state-*`、`--mark-*` token 落地；填色 `mix-blend-mode: multiply`；revealed 改四角角標、候選圈改實線，兩者都沒有 `stroke-dasharray`。
- **記號的幾何改以螢幕 px 計**（`lib/viewer/marks.ts`）。codex 版本把 px 的數字直接當圖面公分畫，全圖時 1cm 只有約 0.26px：答對勾只剩 4.5px、角標臂長 2.4px、焦點環離邊 0.8px。
- `selected` 的線與白襯邊改畫在熱區**外側**（兩條往外偏移的路徑，rect 本身不描邊）。
- **答對勾改成對著熱區右上角的正上方**（DESIGN.md 2026-09-19 修訂）：比稿位置在窗排得密的地方落在隔壁那扇窗上方。會被圖框切掉時換到左上，上方放不下時換到下方。
- 焦點雙環改從熱區邊緣 3px 起畫；勾畫在所有熱區之後，不被 DOM 裡後面的熱區蓋住。
- 測試：勾的大小、對著角、讓開焦點環、整個在框裡（`tests/quiz-feedback.spec.ts`）；幾何常數與 CSS token 同值（`tests/design-language.spec.ts`）。

### 還沒做

- **`normal`、`candidate`、`highlighted` 的線仍描在 rect 上**，以邊為中心、一半壓進熱區。要改成外側路徑，連帶 hover 規則與 `tests/affordance-hint.spec.ts` 等量 rect computed stroke 的斷言都要改。
- `.hotspots rect[data-state]:focus-visible` 仍把 State 的線換成 2px 黑線；DESIGN.md 要的是焦點環疊在 State 上、不取代它。`tests/keyboard.spec.ts` 目前靠這條規則。
