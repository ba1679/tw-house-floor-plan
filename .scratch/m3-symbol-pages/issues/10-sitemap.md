# 10: sitemap

**What to build:** 搜尋引擎抓得到這個網站的全部頁面，不必靠自己爬連結猜。

**Blocked by:** 02、05、07（sitemap 列舉的是這些票產出的網址）

**Status:** done

規格：`.scratch/m3-symbol-pages/spec.md` 的「全站」與 Further Notes 的 MIME 那一條。

## 注意

**19 個網址，不是 18。** 1 首頁 + 14 符號頁 + 3 分類頁 + **平面圖頁本身**。平面圖頁很容易被漏掉，但它是產品本體、也是轉換點的落地處，PRD §8 的資訊架構把它列在第一個。

**本機靜態伺服器的 MIME 表只有 `.html` / `.js` / `.css` / `.txt`**，其餘一律當二進位檔送。sitemap 是 `.xml`，要順手加進去——否則測試可能過了，而你自己本機預覽時瀏覽器把 sitemap 當檔案下載。

**不做結構化資料（JSON-LD）。** PRD 沒要求，多一層要跟著資料維護的東西。

- [x] sitemap 列出全部 19 個網址
- [x] 網址清單由資料算出——加一個符號或一個分類，sitemap 自己變長，不必手改
- [x] 靜態輸出的產物裡真的有 sitemap 這個檔
- [x] 本機預覽時 sitemap 的 content-type 是 xml，不是 `application/octet-stream`
- [x] 沒有列出不存在的網址（例如 `plumbing_electric` 這種不產生頁面的分類）

## Comments

**2026-09-14 — 做完了、兩軸 review、結案。**全套 **163** 條綠（既有 159 + 新增 4，全在 `tests/sitemap.spec.ts`），`npm run typecheck` 乾淨。
真資料一個字沒動。

### 做了什麼

- **`app/sitemap.ts`**：Next 的 sitemap 檔案慣例，build 出 `out/sitemap.xml`，19 個網址，先後照 PRD §8（首頁、平面圖、符號、分類）。
  每一種頁有哪幾張，問的是那些頁面的 `generateStaticParams` 問的同一批函式（`listLayoutIds`、`loadSymbolsForPages`、`loadCategories`）——id 沒有第二份名單。
- **`output: "export"` 之下要 `export const dynamic = "force-static"`**，不寫的話 build 直接拒絕這條 route（Next 文件 static exports 的 Route Handlers 那一節也這樣寫）。
- **只給 `url`**，不給 `lastModified` / `changeFrequency` / `priority`：資料裡沒有說得準「這一頁上次改了什麼」的欄位（`verified_at` 是查證日），後兩者 Google 不看。
- **網址的 origin 由 build 時的 `SITE_URL` 給**，沒給就退回 `http://localhost:${PORT ?? 3000}`，本機預覽打開 sitemap 點得到每一頁。
  sitemap 協定要絕對網址，而 Next 對 sitemap 不套 `metadataBase`——`resolveSitemap` 給什麼印什麼，讀過原始碼。
  跑過：`SITE_URL` 不是合法網址時 build 斷掉（`TypeError: Invalid URL`）；`SITE_URL=https://example.tw` 時 19 筆都在那個網域底下。見下面「留給規格的主人決定」第 1 條。
- **`scripts/serve-static.mjs` 的 MIME 表加 `.xml` → `application/xml; charset=utf-8`**。`out/` 現在剛好五種副檔名。

### 測試（4 條）

1. build 產物裡有 sitemap，列的剛好是資料算得出來的每一頁（點名 `/layouts/3b2l_standard`；排序後整串比，同一頁列兩次也擋得到）
2. 每一個網址都是絕對網址，而且都在同一個網站底下
3. 列的每一頁都真的產出了，產出的每一頁都列在上面——對照 `out/`，不列舉路由。`plumbing_electric` 這種沒有頁面的分類列上去的話，這裡兩邊就不相等
4. 本機預覽送出的 sitemap 是 `application/xml`，上面每一個路徑在本機伺服器上都是 200

四條第一次跑都是紅的（沒有 sitemap）。「網址清單由資料算出」這一條，測試證得到的是「列的等於資料算的」；
要證「加一筆資料 sitemap 跟著變長」得重跑 `next build`，spec Testing Decisions 第 4 條明講不要那樣測。

### 兩軸 review

Spec 軸沒有抓到做錯或多做的東西，提的三件事在下面「留給規格的主人決定」。Standards 軸全是判斷題，處理如下：

- **「掃 `out/` 裡有自己內容的頁」收成一個名字**：`tests/built-html.ts` 加 `contentPages()`，`home-page.spec.ts` 那一份原本幾乎一字不差，改成 import。
  `site-footer.spec.ts` 那一份連 404 一起算，不用它。
- **拿掉測試 3 點名 `plumbing_electric` / `fire_safety` 的那一圈**：它不可能單獨失敗（整串相等已經擋住），而資料哪天合法地有了那一類，它反而成了錯的斷言。
- 測試 3 的前提檢查不寫死 `3b2l_standard`，改從資料取（同 `home-page.spec.ts`）；測試 4 補上「零筆時迴圈安靜全過」的前提檢查。
- `floorplanIds` 改名 `layoutIds`（CONTEXT.md：網址上的單位是 Layout）；讀 sitemap 的三處收成 `builtLocs()`。
- **`app/sitemap.ts` 的註解原本說「這一份沒有自己的名單」，只對 id 成立**：有哪幾種頁、網址前綴是這裡列的。註解改成說清楚這兩件事，以及忘了加一種頁時哪條測試會紅。

**沒改的：**

- **`symbols.sample.json` 的讀取與 `categoriesInData` 在測試裡又多一份。**讀 symbol 資料的已經有 8 份 spec，各自帶自己要的型別；抽成共用模組是動 8 個檔案的事，不在這張票。
- **網址前綴（`/symbols/` 等）在第五個地方又寫一次。**站上沒有共用的路由表，為 sitemap 開一個就得回頭改首頁、分類頁、符號頁與 `highlightHref`；
  sitemap 這一份與頁面分岔時，測試 3 會紅。

### 留給規格的主人決定

1. **正式站的網址沒有主人。**`SITE_URL` 沒設時 sitemap 列的是 localhost——build 不會壞，搜尋引擎則不會收那些網址。今天唯一寫著「上線要設它」的地方是
   `app/sitemap.ts` 的註解；spec、PRD（§10 只寫「Vercel 或類似靜態託管即可」）、CONTEXT.md 都沒有。要不要寫進 M5 的上線條件，或改成「正式 build 沒設就中斷」，是規格的事。
2. **沒有 `robots.txt`。**光有 sitemap，搜尋引擎要嘛靠有人到 Search Console 手動提交，要嘛從 `robots.txt` 的 `Sitemap:` 那一行發現它。
   票面沒要、spec 的路由也沒列，而且它需要同一個 origin，所以沒做——與第 1 條一起放進 M5 比較合理。
3. **測試沒有寫死 19。**Testing Decisions 第 19 條寫的是「列出全部 **19** 個網址」，測試比的是從資料算出來的那一串（今天正好 19），
   與票面「加一個符號，sitemap 自己變長」一致，也與 `category-page.spec.ts` 不寫死 3 同一個理由。代價是：資料裡少了一個符號時，這一組測試不會紅。
