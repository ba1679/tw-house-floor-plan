# 02: 全站 header、品牌與回首頁

**What to build:** 每一頁頂端都有精簡的品牌 header。單色平面圖線框與「平面圖教學」組成一個清楚的回首頁入口；從符號頁、分類、平面圖或找找看都不再被困住。

**Blocked by:** None (can start immediately)

**Status:** resolved

規格：`../spec.md` 的「UX Decisions 1」「Accessibility and Responsive Decisions」；`DESIGN.md`「全站 Header」。

## 注意

- 使用 `SITE_NAME`，不要在元件內再寫一份站名。
- mark 是 code-native 單色線框；不用房屋屋頂剪影、不載圖片／字型、不把彩色帶進介面。
- 整組是一個 link，accessible name 為「回首頁：平面圖教學」，點擊目標至少 44px。
- header 是版面列，不 fixed、不 overlay。平面圖與找找看仍是一個螢幕一頁。
- 首頁原本的站名小字要重新處理，避免兩個一模一樣的 wordmark 只有 header 那個能按。
- 這張只做導覽與版面；`select_content: header_home` 在票 04 接上。

## Acceptance criteria

- [x] 所有建置出的內容頁都有同一個 header 與 `/` 連結
- [x] 非首頁頁面按品牌入口回到首頁；首頁按下仍留在首頁且不 reload 整站資源
- [x] 品牌可存取名稱與可見站名正確，focus-visible 清楚，點擊目標 ≥ 44×44
- [x] header 不載外部圖片、字型或彩色品牌資產
- [x] 375×812 與 320×568 上無水平捲動；平面圖／找找看頁仍不產生 document scroll
- [x] 首頁沒有兩個視覺上相同、卻只有一個可按的 wordmark
- [x] 既有 footer、metadata、頁面 h1 與全套測試維持正確

## Comments

- `SiteHeader` is installed by the root layout. It is a single 44px-or-larger
  `/` link with a code-native plan-line mark; the duplicate homepage wordmark
  was removed and narrow-screen navigation is covered by browser tests.
