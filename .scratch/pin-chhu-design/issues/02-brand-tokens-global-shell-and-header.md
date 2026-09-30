# 02 — 品牌 tokens、global shell 與 Header

Status: ready
Blocked by: 01

## Goal

將米白、深褐外框、木質棕、磚紅、清水灰的品牌層落成 token，並用 compact 拼厝 header 建立全站閱讀外殼，而不改寫圖面與 State contract。

## Scope

- 在 `app/globals.css`（必要時新建相鄰的品牌 token 檔）定義命名 brand／surface／rule／text tokens；不要散落 literal 色碼。
- 更新全站 body、連結、按鈕、focus-visible 與 `components/SiteHeader.tsx`／`.module.css`，使 header 是非浮動的一列、整組連回首頁。
- 維持 footer 與 route layout 行為；確保 header 加入後，layout／quiz 一螢幕的高度預算仍可由後續頁面票驗證。
- 只在 layout shell 與 editoral surfaces 加入克制的框線與格線 primitives；不要直接替內容頁套一堆卡片。

## Constraints

- `--fp-*` 和 `--state-*` 的意義、對比、灰階辨識與使用位置不變；不得以 brand token override 它們。
- 格線是背景節奏，不能落在圖面、Symbol Art、表單、表格或可點元素的 hit target 上。
- 文字對背景達 4.5:1；keyboard focus 保持黑白雙環；控制項保持至少 44 × 44 px hit target。
- 不加 webfont、dark mode、玻璃擬態、重陰影或全站大圓角卡片。

## Acceptance criteria

- [ ] 全站 shell 使用命名 token，沒有跨頁硬寫的 brand 色值。
- [ ] header 顯示 compact mark、拼厝與 Phin-Chhù，整組是單一回首頁連結，沒有 toolbar 化導覽。
- [ ] 品牌背景／線條清楚但不壓過內容；圖面與 State 截圖和 token tests 證實不被色彩覆寫。
- [ ] 375 × 812 與 320 × 568 上不出現 header 引起的水平捲動或不可用控制。

## Validation

擴充 `tests/design-language.spec.ts`、`tests/site-header.spec.ts` 與既有 focus／responsive test seam；跑完整 build。

