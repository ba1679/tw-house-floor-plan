# 10: sitemap

**What to build:** 搜尋引擎抓得到這個網站的全部頁面，不必靠自己爬連結猜。

**Blocked by:** 02、05、07（sitemap 列舉的是這些票產出的網址）

**Status:** ready-for-agent

規格：`.scratch/m3-symbol-pages/spec.md` 的「全站」與 Further Notes 的 MIME 那一條。

## 注意

**19 個網址，不是 18。** 1 首頁 + 14 符號頁 + 3 分類頁 + **平面圖頁本身**。平面圖頁很容易被漏掉，但它是產品本體、也是轉換點的落地處，PRD §8 的資訊架構把它列在第一個。

**本機靜態伺服器的 MIME 表只有 `.html` / `.js` / `.css` / `.txt`**，其餘一律當二進位檔送。sitemap 是 `.xml`，要順手加進去——否則測試可能過了，而你自己本機預覽時瀏覽器把 sitemap 當檔案下載。

**不做結構化資料（JSON-LD）。** PRD 沒要求，多一層要跟著資料維護的東西。

- [ ] sitemap 列出全部 19 個網址
- [ ] 網址清單由資料算出——加一個符號或一個分類，sitemap 自己變長，不必手改
- [ ] 靜態輸出的產物裡真的有 sitemap 這個檔
- [ ] 本機預覽時 sitemap 的 content-type 是 xml，不是 `application/octet-stream`
- [ ] 沒有列出不存在的網址（例如 `plumbing_electric` 這種不產生頁面的分類）
