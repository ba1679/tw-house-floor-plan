# 01: 套用介面 token 與可讀性規則

**What to build:** 把 `DESIGN.md` 與 `design/_tokens.txt` 定案的介面層 token 套進現有頁面與元件，修掉已知的字級、文字對比、字體與焦點樣式問題。

**Blocked by:** None

**Status:** done

設計依據：根目錄 `DESIGN.md`；值：`design/_tokens.txt` 的「介面」段。

## 範圍

- 在 `app/globals.css` 建立定案的 `--paper*`、`--ink*`、`--rule*`、系統字體、間距、圓角、控制項高度與焦點 token，並宣告 `color-scheme: light`。
- 刪掉 `--accent*`、`--serif`、`--mono` 與不實際存在於 iPhone／Android 系統字體的說明；不載 webfont。
- 全站介面文字只用 `--ink`／`--ink2`；`--ink3` 只留給需要 3:1 的非文字線。現有 10.5px 文字提升到至少 12px。
- 連結改為墨色加底線；主要／次要按鈕與可點整列照 `DESIGN.md` 的無彩規則。淺灰表面只能分組，不能是唯一的可點線索。
- 全站介面控制項的 `:focus-visible` 統一為黑白雙環，跟著元件圓角走。
- 新增一支跑在 Playwright node context 的 token 對比測試；直接讀 `app/globals.css` 計算，不另加測試框架。寫法可參考 `tests/search-matching.spec.ts`。

## 不做

- 不改平面圖圖面色票；由票 02 處理。
- 不改 SVG 熱區狀態、候選圈或答對記號；由票 03 處理。
- 不重畫首頁、分類頁、符號頁或說明卡的版面；本票只把既有介面套進定案語言。

## Acceptance criteria

- [x] `app/globals.css` 的介面 token 與 `design/_tokens.txt` 定案值一致，且只用系統字、不載 webfont
- [x] 全站介面文字不小於 12px；沒有文字使用 `--ink3`
- [x] 所有文字／背景組合達 WCAG AA 4.5:1；測試會讀 CSS 並在值退步時失敗
- [x] 連結、主要按鈕、次要按鈕與可點整列符合 `DESIGN.md`，不再使用彩色強調
- [x] 所有介面控制項的 `:focus-visible` 都是同一套黑白雙環，內外兩色對比至少 9:1
- [x] `npm run typecheck`、`npm test` 通過


## Comments

**2026-09-19：做完了。** 前半由 codex 實作，Claude 接手收尾。`npm run typecheck` 乾淨，`npm test` 227 條全綠。

### 做了什麼

- `app/globals.css`：介面、字級、間距、圓角、觸控、層次、焦點 token 照 `design/_tokens.txt` 落地，宣告 `color-scheme: light`；`--accent*`、`--serif`、`--mono` 全數移除。
- 各 CSS Module：`--ink3` 不再用於文字，10.5–11.5px 的字全部提升到 ≥ 12px；連結改墨色加底線。
- 全站 `a`、`button`、`input` 的 `:focus-visible` 統一為黑白雙環（box-shadow，跟著圓角走）。
- `tests/design-language.spec.ts`（node context）：token 值、字級下限、文字對比、主要按鈕反白字、焦點 9:1、字重只用 400／600／700。

### 收尾時補的

- **找找看入口的點擊範圍退回 32px**（codex 改的）：已改成膠囊形次要按鈕，看得見 32px、上下 6px 透明框撐到 44px，並補測試（`tests/quiz-entry-points.spec.ts`）。
- 三處 `font-weight: 500` 改成 600；「其他位置」列標題改用 `--text-row-title-*`。

### 沒做、留給後續

- 符號頁「容易搞混」仍是分隔線加底線連結，不是 DESIGN.md 的「淺灰卡片＋右箭頭」：那是重畫版面，本票明寫不做。
- `components/Quiz.module.css` 仍有寫死的 20px／15px／13px（20px 不在字級階梯裡），留給 M4 票 08 的找找看版面。
- `design/_tokens.txt` 要在三張實作票都完成後刪除（DESIGN.md 開頭），票 03 還沒完成，所以還留著。
