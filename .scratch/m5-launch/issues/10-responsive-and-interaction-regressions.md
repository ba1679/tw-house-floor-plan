# 10: 代表頁 RWD 與既有操作回歸

**What to build:** 讓首頁、FloorPlan、Symbol、分類與找找看五種頁面在手機、窄螢幕與桌面都能完成主要工作，並在修正版面時保留既有的鍵盤、焦點與 ARIA 行為。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 為五種代表頁建立 375 × 812 的使用者可見行為案例：標題與主要入口可見、頁面能完成自己的核心工作
- [x] 同五種代表頁在 1280 × 900 下沒有手機固定尺寸造成的斷裂，FloorPlan 與主要控制仍可操作
- [x] 同五種代表頁在 320px 寬時整頁 `scrollWidth <= clientWidth`
- [x] FloorPlan 代表案例確認圖框有正尺寸、兩段式點擊可開 InfoSheet、卡片控制元件仍可用
- [x] 找找看代表案例確認開場可見、可以開始一局且圖框沒有被新內容壓成不可操作
- [x] Symbol 與分類長文／清單不被裁切，主要連結與搜尋框不溢出
- [x] 修正 CSS 前遵守既有 Design Language 與 token；如需偏離先更新設計規則，不在 CSS 暗中發明例外
- [x] 測試只斷言關鍵幾何與外部行為，不用整頁像素 snapshot 鎖死所有視覺細節
- [x] 既有鍵盤、焦點回復、accessible name、status live region 與 quiz 名稱隱藏測試全部維持通過
- [x] 不新增 axe、VoiceOver／NVDA gate 或 WCAG 合規聲明，也不移除任何已完成的無障礙能力
