# 08: 首頁分享識別與 SEO foundation

**What to build:** 讓首頁在搜尋結果、社群分享、瀏覽器分頁與手機主畫面都有一致且可辨認的網站身份，並建立其他頁面可以沿用的 canonical、Open Graph 與 JSON-LD 基礎。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 先依既有 Design Language 製作簡化平面圖線稿識別，不暗示任何特定建案或重畫完整頁面
- [x] 產出一張 1200 × 630 的共用 Open Graph 圖，文字與圖形在常見分享裁切下仍清楚
- [x] 產出小尺寸可辨認的 favicon 與 Apple touch icon；三種資產共享同一個視覺識別，但不是直接把完整 OG 圖縮小
- [x] 建立單一 production base URL／canonical／Open Graph 組裝邊界，沿用現有環境優先序且不新增自訂網域依賴
- [x] 首頁有絕對 canonical、page-specific Open Graph title／description／URL／site name／locale／image
- [x] 首頁輸出合法的 `WebSite` JSON-LD，name、description、url、inLanguage 與可見內容一致
- [x] Production metadata 不得輸出 localhost；本機與測試仍能使用明確的測試 base URL
- [x] Build 產物能找到 OG 圖、favicon 與 Apple touch icon，metadata 指向的資產皆存在
- [x] 靜態 HTML 測試驗證 canonical、Open Graph、JSON-LD 與 icon links；不以 React helper 的內部形狀作為斷言
- [x] 不加入每個 Symbol 各一張圖片的生成 pipeline，也不承諾 rich result
