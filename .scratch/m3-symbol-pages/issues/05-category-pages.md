# 05: 分類頁

**What to build:** 想一類一類看完的人，可以打開「結構」「門窗」「家具家配」三張頁，各自看到該分類底下有哪些符號，點任一個進到它的符號頁。

**Blocked by:** 02（分類頁列出的符號要連得到符號頁）

**Status:** ready-for-agent

規格：`.scratch/m3-symbol-pages/spec.md` 的「分類頁」「建置時驗證」第 3 條。

## 注意

**分類清單由資料算出，不寫死。** 掃過所有符號的 `category`，出現過的才產生頁面。現在是 3 頁。

**不要為沒有符號的分類產生空頁面。** 驗證器的合法分類目前還留著 v0.4 砍掉的 `plumbing_electric` 與 `fire_safety`。空頁面會被 Google 當 thin content，連帶拖累整站；而「此分類階段一尚未收錄」對使用者沒有價值。

**也不要另外手寫一份「就這 3 類」的常數。** 那會變成第二份會跟資料分岔的名單，正是 PRD §9「不得各自維護副本」要防的事。

**建置檢查刻意拆成兩半，各自用看得到事實的語言把關。** 中文名在 TypeScript 的文案常數裡，而資料驗證器是掛在 prebuild 的 Python——它讀不到那個常數。寫成「每個分類都要有中文名」就得在 Python 裡再抄一份中文名。所以：**Python 管「資料裡的分類合不合法」，TypeScript 管「合法的分類有沒有中文名」**（文案常數的型別是以分類為 key 的 `Record`，少一個 key 直接編譯失敗）。合起來的保證相同，但沒有重複的資料。

- [ ] `/categories/<id>` 三頁，全部回 200
- [ ] 分類清單由資料算出；`plumbing_electric` 與 `fire_safety` **不產生頁面**
- [ ] 每頁列出的符號數與資料一致，各自連得到符號頁
- [ ] 中文名來自既有的文案常數，不在元件裡重打
- [ ] 每頁有自己的標題與 meta description
- [ ] 資料驗證收窄合法分類到階段一三類，錯誤訊息說明設備類是 v0.4 砍出範圍的、不是打錯字
- [ ] 文案常數少一個分類的中文名時，`npm run typecheck` 失敗
- [ ] 375px 下不溢出

## Comments

**2026-09-13 — 做完了。**全套 **108** 條綠（既有 98 + 新增 10：`tests/category-page.spec.ts` 8 條、
`tests/build-validation.spec.ts` 2 條），`npm run typecheck` 乾淨，建置時的資料驗證 0 errors、
1 warning（樑那條預期中的）。真資料一個字沒動。

`/categories/structure`、`/categories/door_window`、`/categories/furniture` 三頁，全部由
`lib/symbols/data.ts` 的 `loadCategories()` 從資料算出：掃過符號的 `category`，出現過的才算一類，
分類之間與一類之內的順序都照資料檔。它疊在 `loadSymbolsForPages()` 上面分組，**不是第四種投影**——
分類頁與符號頁顯示的是同一批字，差別只在一次顯示幾個。

### 與票面矛盾的一處：PRD 的 symbol schema 還列著五類

`平面圖教學網站-PRD-Phase1.md` 第 413 行的 symbol schema 仍寫
`category: enum [structure, door_window, plumbing_electric, fire_safety, furniture]`，
與這張票收窄後的驗證器、也與 PRD 自己 §4.1 的 v0.4 決議對不上。照著那一行替新符號填
`plumbing_electric` 的人會撞上驗證錯誤——訊息會指回 §4.1，所以他拿得到正確答案，但 schema 那一行本身
已經過期。**沒有改 PRD**，不在這張票的範圍，留給能改規格的人決定。

### 建置檢查的兩半，各有一條測試

- **Python 半邊**：`VALID_CATEGORIES` 收窄到三類。訊息說得出設備類不在清單上「不是打錯字，是 v0.4
  刻意砍出範圍的」、設備符號不畫在建案平面圖上（PRD §4.1），以及放行的後果：多長一張分類頁，而文案常數
  裡沒有它的中文名。測試釘的是「不是打錯字」那一句本身，不只是「v0.4」。
- **TypeScript 半邊：做成了真的測試，沒有只靠型別。**沿用 sandbox 手法：`app/`、`components/`、`lib/`、
  `tsconfig.json` 複製進 tmp，symlink `node_modules`，刪掉 `CATEGORY_LABELS` 的一個 key（從資料取第一個
  分類，不寫死），跑 repo 自己那支 `tsc --noEmit`，斷言非零退出、錯誤訊息點名那一類與 `copy.ts`。
  刪之前先跑一次沒動過的沙盒並斷言它是綠的——否則「失敗」可能只是沙盒自己搭壞了。整條 3–4 秒。
  **一個陷阱**：repo 的 `next-env.d.ts` import 了 `.next/types/*`（`next build` 的產物），照抄進沙盒
  會讓 tsc 死在找不到那兩個檔案上，所以沙盒自己寫一份只有兩行 `/// <reference>` 的最小版本。
- 讓那道型別保證在頁面上真的有作用：分類頁拿 `SymbolCategory` 型別的 `id`（`findCategory()` 的回傳值）
  去查 `CATEGORY_LABELS`，不是網址上的字串——用字串查就得先 `as SymbolCategory` 硬轉，那一轉就是保證
  斷掉的地方。

### 測試怎麼讀「分類頁剛好 3 張」

spec Testing Decisions 第 9 條寫「剛好 3 張」。測試**沒有寫死 3**：斷言的是建置產物的頁面集合等於資料裡
出現過的分類集合（今天正好 3），再點名 `plumbing_electric` 與 `fire_safety` 不在其中。寫死 3 的話，
測試自己就成了第二份會跟資料分岔的名單。唯一抄下三個分類的是測中文名的那一條——刻意再打一次中文名，
同 `symbol-page.spec.ts` 的 `TIER_COPY`：從常數 import 的測試證不出常數本身被改壞。

### 小決定與沒做的事

- 每一列是「符號圖形＋名字＋白話意思」，整列一個連結到 `/symbols/<id>`。圖形取自 sprite（`SymbolArt`），
  在列表裡 `aria-hidden`：符號頁的圖是內容，列表裡它的替代文字會併進連結名字，名字唸兩次。
- 標題「平面圖上的○○符號有哪些？」與 `<h1>` 同一句；description 數出這一類的符號名；頁面上另有
  「共 N 個符號」。三個新文案常數：`categoryPageTitle`、`categoryPageDescription`、`categoryCountLabel`。
- 沒做：頁尾免責聲明（票 04 加在根版面，合併後自動繼承）、搜尋框（票 06）、`/symbols` 索引頁（spec 明確拒絕）。
- **目前還沒有任何頁面連到分類頁**：入口是票 07 的首頁，sitemap 是票 10。
