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

- [ ] 五種熱區 State、候選圈、答對勾與焦點環皆使用有語意名稱的 token，不再散落匿名 oklch 值
- [ ] `revealed` 與候選圈沒有 `stroke-dasharray`；門扇軌跡仍保留圖面既有虛線
- [ ] `selected` 與 `revealed` 在灰階下可由完整框／填色和四角角標分辨，不只靠色相
- [ ] 狀態線在熱區外側、填色使用 multiply，不遮淡符號線；白襯邊只給 `selected`、`revealed` 與答對勾
- [ ] 答對勾只在答對的 `selected` 出現，位於右上外側且不與焦點環重疊；答錯不出現
- [ ] 藍線、暖線與答對勾對 `--fp-paper`、`--fp-wall` 都達 3:1，並由測試守住
- [ ] 焦點雙環疊在每一種 State 上仍清楚，兩色彼此至少 9:1
- [ ] `npm run typecheck`、`npm test` 通過

