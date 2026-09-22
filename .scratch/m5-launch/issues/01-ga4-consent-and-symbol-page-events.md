# 01: GA4、Consent Mode 與 Symbol 頁事件

**What to build:** 讓站長能從 GA4 看到使用者在 Symbol 頁真正讀到哪個解釋、是從搜尋還是分類入口抵達，同時讓台灣階段一流量不被 consent modal 阻擋，且在沒有 Measurement ID 的環境完全不送資料。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 建立單一 typed Analytics adapter；產品端只送 `symbol_view`，沒有頁面或元件直接操作 GA queue／API
- [x] `symbol_view` 固定包含 `symbol_id` 與 `source`，且不含姓名、帳號、搜尋文字、外部 referrer、熟悉度或其他學習進度
- [x] Measurement ID 缺席或格式不合法時不載入 GA script、adapter 安全 no-op，頁面功能照常工作
- [x] Consent Mode default 在 GA config 與任何 event 之前執行；台灣的 `analytics_storage` 為 `granted`，非台灣 fallback 為 `denied`
- [x] `ad_storage`、`ad_user_data`、`ad_personalization` 一律為 `denied`，本票不加入 consent modal 或廣告整合
- [x] 乾淨 Symbol URL 與非法 `from` 預設送 `source=search`；站內搜尋結果明示 `from=search`，分類清單明示 `from=category`
- [x] Symbol 頁成功 hydration 後只送一筆事件；React 重繪不會重複送出
- [x] 真瀏覽器測試從 GA 邊界觀察 event 與 consent 指令順序，且阻止測試資料實際送往 Google
- [x] 測試證明站內搜尋與分類入口送出不同 `source`，而外部 referrer 不會改寫此欄位
