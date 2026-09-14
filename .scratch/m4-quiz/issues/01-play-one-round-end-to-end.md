# 01: 一局找找看從頭玩到尾

**What to build:** 他在三房兩廳的找找看頁按「開始」，題目寫「找出這張圖上的窗」，圖鎖在全圖。他照平常看圖的方式點——點大略位置、圖自動放大、再點一次確認——**那一下就是他的答案**，畫面告訴他對或錯，他按「下一題」。7 題之後，結算畫面告訴他答對幾題。

**Blocked by:** None (can start immediately)——但動手前先跑 `/codebase-design`（見下）

**Status:** done

規格：`.scratch/m4-quiz/spec.md` 的「路由與頁面」「可出題符號、題數與出題」「作答」「一局的流程」「首次引導」。

## 動手之前：`/codebase-design`

這張票第一次讓檢視器出現在「自由看圖」以外的地方。有三件事要先定模組邊界，02、03 會照著走：

1. **作答後的暫停**是狀態機的第四個 stage，還是找找看包在檢視器外面的一層——ADR-0006「什麼情況下該推翻它」寫的正是這種 browsing 沒有的行為
2. **說明卡怎麼由外部指定它顯示的符號**——找找看答錯時卡片是題目符號，`selected` 是被點中的另一個；自由看圖時兩者永遠相同
3. **找找看頁怎麼組出一個檢視器**：不帶 `?symbol=` 高亮、由頁面自己在出題期間打開視野鎖定、底下多一條題目與回饋

這張票只需要第 3 件落地。1、2 的結論寫進 02 的票面，若決定新增 stage 或外包一層，補 ADR。

## 注意

- **可出題符號只有一種算法**：題目池、題數、「這張圖產不產生找找看頁」都問它，04 的進度分母也問它。不得各算各的
- **題數 = ⌈可出題數 ÷ 2⌉**，主圖 7。這張票還沒有進度紀錄，出題就是從可出題符號裡隨機挑、不重複——**優先序是 04 的事**
- **作答** = 第二段確認了一個熱區，或鍵盤 Enter／空白鍵選定一個熱區。第一段圈出候選、重選、第二段沒點中都不是
- **這張票的回饋刻意陽春**：「答對了／答錯了」與「下一題」。標出答案、圖暫停、說明卡都是 02
- 視野鎖定用狀態機既有的開關，由找找看頁在出題期間打開。平面圖頁那個 `?fitLocked=1` 這張**先不拆**（07）
- **noindex、不進 sitemap**。sitemap 測試「產出的每一頁都列在上面」拿建置產出的每一頁對 sitemap，找找看頁一產出它就紅——改成比對時排除宣告 noindex 的頁，看頁面自己的宣告，不另列一份「哪些路徑不算」的名單
- 一局的進行狀態只在記憶體裡：重新整理回到開場，不跳離開確認

## Acceptance criteria

- [ ] 找找看頁以 layout id 定址，只替有可出題符號的 layout 產生；不寫死 `3b2l_standard`
- [ ] 頁面有自己的標題與描述（不等於平面圖頁），帶 noindex
- [ ] sitemap 仍是 19 個網址、不含找找看頁；sitemap 測試排除 noindex 頁之後照樣綠
- [ ] 按「開始」出第 1 題；題目文字是 `symbol.name` 原文；看得到題號 / 題數（主圖為 x / 7）
- [ ] 一局的 7 題互不重複，全部是可出題符號（樑不會出現）
- [ ] 出題期間雙指縮放、拖曳、雙擊放大都被擋；第一段的自動 3× 照常
- [ ] 第一段圈出候選、按「重選」、第二段沒點中：都不前進到回饋
- [ ] 點中題目符號的任一處 = 答對；點中別的符號 = 答錯；鍵盤 Enter／空白鍵選定熱區的判定與手指路徑相同
- [ ] 「下一題」前進到下一題；第 7 題之後進結算，顯示答對數 / 題數
- [ ] 答到一半重新整理 → 回到開場
- [ ] 第一次進站的引導與平面圖頁**共用同一句、同一個記錄**：在平面圖頁看過，找找看不再出現；清空之後直接進找找看會出現
- [ ] 可出題符號與題數是不碰 DOM、不讀 localStorage 的純函式；node context 測試餵手寫小輸入，涵蓋可出題數 13 → 7、12 → 6、1 → 1、0 → 0
- [ ] 既有測試維持綠

## Comments

**2026-09-14：`/codebase-design` 的結論。** 三件事都定了，暫停的形狀寫成 `docs/adr/0007`。

這張落地的是第 3 件，外加第 1 件的骨架：作答總要有個地方認，這張就得有。第 1、2 件接下來怎麼長，寫在 02 的 Comments；中性標籤寫在 03 的 Comments。

### 模組怎麼切

```
平面圖頁 ── FloorPlanViewer（自由看圖，持有 reduceViewer）────────┐
                                                               ├─> FloorPlanViewport（框，不持有 reducer）
找找看頁 ── 找找看（持有 reduceRound，reduceViewer 包在它裡面）───┘
```

框有兩個呼叫端，接縫是真的（不是只為了測試假想出來的）。一局只有一個呼叫端，它不是接縫，是一個模組：
介面很小（建一局、轉一個 action），背後藏的是認作答、暫停與標記。

#### 1. 先做一次純搬移，自己一個 commit

把 `FloorPlanViewer` 拆成**不持有狀態機的框**，與自由看圖那一側。平面圖頁照舊寫 `<FloorPlanViewer floorplan symbols readingOrder />`。
**既有測試一條不改、全綠**，就是這一步的驗收。

**放進框裡的：**
- 量框（`RESIZE`）
- 手勢
- 畫布位移
- 圖面與房間變暗
- 熱區層：閱讀順序、焦點平移、Enter／空白鍵
- 容錯圈
- 「重選／回到全圖」那一列
- 兩段式進行中的三句狀態列：圈出 N 個候選、還是沒點到、這附近沒有
- 第二段的 Esc

**留在自由看圖那一側的：**
- `useReducer(reduceViewer)`
- `?symbol=` 高亮與樑的橫幅
- `?fitLocked=1`（07 拆）
- 說明卡：開哪張、關了做什麼、焦點還回哪個熱區，以及卡片開著時的 Esc
- 狀態列在兩段式沒在進行時說什麼
- 首次引導的 hook：呼叫之後交給框

`TAP_HINT` 搬進文案模組，兩側共用同一句。

框的介面大約是這個形狀（草稿，名字實作時可以換）：

```ts
type FloorPlanViewportProps = {
  floorplan: FloorPlan;
  symbols: Record<string, SymbolRecord>;
  readingOrder: RoomHotspots[];
  /** 狀態機由呼叫端持有：找找看要在它外面包一層，框不能自己 useReducer。 */
  viewer: ViewerState;
  dispatch: Dispatch<ViewerAction>;
  /** 說明卡開著：房間變暗打開。 */
  dimRooms: boolean;
  /** 兩段式沒在進行時（不在第二段、也不是剛點到空白處），狀態列說這一句。 */
  restingStatus: string;
  hint: FirstVisitHint;
  /** 手指碰到圖、鍵盤選定熱區時，呼叫端各自要收掉自己的東西（「找不到網址指定的符號」那句、鍵盤來源）。 */
  onTouch?: () => void;
  onKeyboardSelect?: (hotspotId: string) => void;
};
```

02、03 會再加 `selectedHotspot`、`revealedSymbol`、`paused`、`names` 四個輸入，這張不先加。

#### 2. `lib/quiz/questions.ts`（純函式，seam ③）

- 包含 `quizzableSymbols`、`roundSize`、`pickQuestions`。
- 誰問它：找找看頁產不產生、題數、題目池；05 的分母、06 的首頁入口也問它。
- 建在 `lib/floorplan/hotspots.ts` 既有的判斷上：「可出題」與 `isSymbolAbsent` 必須是同一件事的正反兩面。
- 這張的 `pickQuestions` 是均勻隨機，依進度排優先序是 04 加。

#### 3. `lib/quiz/round.ts`（純 reducer）

一局，把 `ViewerState` 包在裡面：

```ts
type Answer = { target: string; picked: string; hotspotId: string };
type RoundState = {
  questions: string[];
  answers: Answer[];
  phase: "question" | "answered" | "finished";
  viewer: ViewerState;
};
type RoundAction = { type: "VIEWER"; action: ViewerAction } | { type: "NEXT" };

function createRound(viewer: ViewerConfig, questions: string[]): RoundState; // 檢視器一建出來就 fitLocked
function reduceRound(s: RoundState, a: RoundAction): RoundState;
```

以下規則就是它的介面，02、03 照著長：

- **出題中**：action 照轉 `reduceViewer`。轉完之後檢視器若走進 `confirmed`，那一下就是作答，在**同一次轉移**裡做三件事：
  1. 記下 `Answer`
  2. 派 `RESELECT` 讓檢視器回到閒著
  3. `phase` 變成 `answered`

  第一段圈出候選、重選、第二段沒點中都走不進 `confirmed`，不必另外判斷。
- **`answered`**：只有 `RESIZE`、`FOCUS_HOTSPOT`、`RESET_VIEW` 轉得進去，其餘原樣回傳（同一個物件，不重畫）。
  這條擋法這張就做，不擋的話作答後還能再圈出候選。暫停的畫法與測試是 02 的事。
- **`NEXT`**：最後一題 → `finished`；否則回到出題中，並對檢視器派 `RESET_VIEW`。
- **`finished`**：什麼都不收。
- **不寫 localStorage**：04 的「每作答一題立刻寫入」，由頁面在 `answers` 變長時寫。
- **`phase` 不叫 stage**：`CONTEXT.md` 的 Stage 指的是檢視器。

不另寫 node 測試：spec 的 seam ③ 只給出題函式；一局的規則由找找看頁的瀏覽器測試走過。

#### 4. 找找看頁

- 開場畫面不掛檢視器。按「開始」才用 `Math.random` 出題、建一局。
- 一局一個 `key`：「再玩一次」換一個 key，就是乾淨的新局。
- **不掛 `HighlightFromQuery`**：網址高亮只存在於自由看圖那一側，03 補測試釘住就好。
- 題目列與作答後的回饋、「下一題」若能共用一列，框就少被挖一列高度。找找看頁有自己的版面，但 ADR-0003 的道理一樣適用。

**2026-09-14：做完了。** 全套 **177** 條綠：既有 163 條，加上新增 14 條（`tests/quiz-questions.spec.ts` 3 條、`tests/quiz-page.spec.ts` 11 條）。`npm run typecheck` 乾淨。

### 做了什麼

- **純搬移**（7c74b0d）：拆出 `FloorPlanViewport`，照上面的切法。既有 163 條測試一條未改、全綠。
- **兩個純模組**：`lib/quiz/questions.ts`、`lib/quiz/round.ts` 照上面的設計做。
- **找找看頁 `/layouts/[id]/quiz`**，流程依序：
  1. 開場：「開始」在 client 接手之前是停用的。
  2. 出題：題目列（題號 / 題數、`symbol.name` 原文）加上圖。
  3. 作答後：狀態列說「答對了。」或「答錯了。」，下面出現「下一題」。
  4. 結算：「答對 N / 7 題」，加上「再玩一次」。
- **sitemap 測試**改成排除自己宣告 noindex 的頁（`tests/built-html.ts` 的 `isNoindex`）。
- **fitLocked 那條測試**：在找找看頁照同一組步驟另寫了一份。平面圖頁那份原封不動留在 `pan-zoom.spec.ts`，由 07 刪。

### 測試抓得到回歸

刻意改壞四處，跑一次：
- 一局不開視野鎖定
- 鍵盤選定不算作答
- 每題都判成答對
- 第一題不說首次引導

四處各自對應的那一條測試紅，其餘七條綠。還原之後全綠。

### 兩軸 review 之後改的

- **文案進文案模組**：圖框裡的「重選」「回到全圖」與兩段式的三句狀態列。兩頁共用這個圖框之後，字散在元件裡正是 PRD §3 要防的事。
- **初始設定只留一份**：檢視器的初始設定（占位尺寸）改由兩頁共用 `initialViewerConfig`。
- **按鈕字改回 spec 原文**：最後一題的按鈕原本寫「看結果」，改回「下一題」。02、07 的驗收都用這個字。
- **測試**：題數收成一個 `ROUND_SIZE` 字面值常數，刪掉沒人呼叫的 helper。
- **註解**：頁面裡一句把「不產生」寫反的註解，改正。

### review 提過、沒改的

- **「沒有可出題符號就不產生這一頁」只驗得到一半**：真資料每張圖都有熱區。判斷只有 `quizzableSymbols` 一處，node 測試有空輸入那一條。
- **測試裡「主圖上有熱區的符號」和程式用同一個判斷**：那是 `CONTEXT.md` 的定義本身，不是出題的演算法。
- **兩個輕微的重複**：`floorplan, symbols, readingOrder` 三個 props 總是一起傳；`nameOf` 有兩份。等 03 改熱區替代文字時一起看。

### 小決定

- **「再玩一次」這張就先做了**（它是 05 的驗收項）。結算畫面沒有出口的話，只能靠重新整理再玩。
  - 做法是換一個 key 開新局。
  - 依進度出題是 04／05 接上的事，這張沒替它寫測試。
- **作答結果說在狀態列**（`role="status"`），不另起一行：用鍵盤作答的人聽得到。
- **作答後鍵盤焦點留在熱區上**：「下一題」排在所有熱區之後，要 Tab 很多下才到。
  - 02 答錯會打開說明卡並收焦點，到時一起處理答對的情況。
