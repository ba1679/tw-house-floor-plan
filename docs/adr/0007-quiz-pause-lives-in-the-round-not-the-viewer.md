---
status: accepted
date: 2026-09-14
---

# 作答後的暫停歸一局管，不是檢視器的第四個 stage

找找看作答之後、按「下一題」之前，圖是暫停的。這段時間裡：
- 點圖、雙擊、雙指、拖曳、鍵盤 Enter／空白鍵都不改變任何事。
- 被點中的熱區與題目符號的每一處（`selected`、`revealed`）都留在圖上。
- 說明卡開或關都不影響這些標記。

詳見 `.scratch/m4-quiz/spec.md`「作答之後、按『下一題』之前」。

做法：**一局**（`lib/quiz/round.ts`）是一個純 reducer，檢視器的狀態機包在它裡面。檢視器的 action 都先經過它：

1. **出題中**：action 照轉給 `reduceViewer`。
2. **認出作答**：轉完之後檢視器若走進 `confirmed`，那一下就是作答。一局記下作答，**在同一次轉移裡把檢視器退回 browsing**，進入暫停。
3. **暫停期間**：只有 `RESIZE`、`FOCUS_HOTSPOT`、`RESET_VIEW` 轉得進去，其餘整個 action 不收。
4. **標記**：`selected` 與 `revealed` 由一局交給畫面，不在 `ViewerState` 裡。

**`Stage` 仍然只有 `browsing` / `candidates` / `confirmed` 三個**，`reduceViewer` 不知道有找找看。

## 為什麼這值得寫下來

- **難逆**：作答怎麼認、標記住在哪裡、說明卡的開關歸誰，全部跟著這個決定走；M4 票 02、03 都建立在它上面。
- **會被問**：ADR-0006「什麼情況下該推翻它」的第一條是：需要一套 browsing **沒有**的行為時，它才真的是一個階段。
  暫停字面上正是這種行為，讀過 0006 的人會問它為什麼沒有變成第四個 stage。
- **有具體被拒絕的替代方案**，見下。

## 考慮過的替代方案

1. **第四個 stage（`answered`）。** 暫停確實符合 ADR-0006 那一條。放棄它不是因為「它其實就是 browsing」，而是它不需要住在檢視器裡：

   - **它的行為只有一種：不收。** 一個 stage 值得存在，是因為同一個 action 在它底下要做**不同的事**：`TAP` 在 candidates 是確認，在 browsing 是第一段。
     暫停底下，每個 action 的答案都是「原樣回傳」，擋在 reducer 前面就能完整表達。
     若放進 reducer 裡，`tap()`、`DOUBLE_TAP`、`SELECT_HOTSPOT`、`RESELECT`、`RESIZE` 各自都要多寫一條「answered 時原樣回傳」。
   - **標記要撐過檢視器自己的重置。** 框的寬度一變，檢視器會刻意退回 browsing 並清掉 `selected`，因為候選是用舊的比例尺挑的。
     手機在作答後轉成橫向時，stage 版本得替 `RESIZE` 開例外。標記歸一局管，就沒有東西會被清掉。
   - **說明卡的開關與暫停無關。** 在檢視器裡，`confirmed` 就等於說明卡開著。找找看不是這樣：
     - 答對時卡片不開，按「看說明」才開。
     - 卡片關掉後圖仍在暫停。

     第四個 stage 照樣得另外用一個欄位記卡片開沒開。
   - **自由看圖會多出一個永遠進不去的 stage。** 每一個看 stage 的地方都得回答它：
     - 上面列的那幾個 case
     - 控制列、Esc、狀態列
     - 房間變暗
     - `[data-stage="browsing"]` 的 CSS

2. **在 `ViewerState` 裡加一個 `frozen` 開關，像 `fitLocked` 那樣。**

   `fitLocked` 放在檢視器裡是對的：它要**看進 action 的效果裡**才分得出該擋哪些。
   - 擋雙指縮放，不擋第一段的自動 3×。
   - `DOUBLE_TAP` 在 browsing 是放大，要擋；在 candidates 是確認，不擋。

   外面那一層只看得到 action 的種類，切不出這一刀。

   暫停則不需要看進去，整個 action 不收就好。而且這個開關必須在「確認了一個熱區」的**同一次轉移**裡打開。
   做得到這件事的，要嘛是檢視器自己知道「確認就是作答」，要嘛還是得有外面一層。

3. **元件裡並排兩份 state，用 dispatch 過濾、用 effect 認作答。** 也就是：
   - 元件同時持有檢視器的 reducer 與一局的 state；
   - dispatch 之前先過濾 action；
   - 用 effect 觀察 stage 變成 `confirmed`，再記下作答。

   這樣要晚一輪 render 才認得出作答。中間那一格，檢視器已經 `confirmed`，一局卻還沒記下；
   卡片該開哪張、標記該畫哪些，兩份 state 說法不一致。過濾與認作答也都寫在元件裡，要有 DOM 才測得到。

## 劃線的規則

- **要看進 action 內部效果才決定的規則，放檢視器；整個 action 收或不收的規則，放外面那一層。**
- **標記住在結束它的那一層。**
  - `highlighted` 由檢視器自己的動作結束（開始選東西就清，ADR-0006），所以住在 `ViewerState`。
  - 作答後的 `selected` 與 `revealed` 由「下一題」結束，檢視器的動作碰不到它們，所以住在一局。

## 後果

- **作答的定義綁在「走進 `confirmed`」上。** 今天走得進去的路只有 `confirmSelection`，也就是第二段確認與鍵盤選定熱區，正好就是 PRD 的作答。
  **日後若替 `reduceViewer` 加一條走進 `confirmed` 的新路，它在找找看裡自動成為一種作答方式**，加的人要回頭確認這是不是想要的。
- **暫停期間檢視器是閒著的**：`browsing`、沒有選中、沒有候選。畫面上的 `data-stage` 因此是 `browsing`。
  browsing 下那層「這裡可以點」的底色與 hover（`components/FloorPlanViewer.module.css`）必須另外認得暫停，
  否則其餘熱區會在一張點不動的圖上全部亮起來。
- **狀態機的持有者往上移。** 檢視器拆出一個不持有 reducer 的框，負責量框、手勢、畫布與熱區層。
  自由看圖與找找看各自持有自己的 reducer，再交給這個框。平面圖頁檢視器對外的介面不變。
- **`revealed` 不進 `ViewerState`**，因此不會與 `highlightedSymbol` 共用欄位（spec 要求兩者分開）。

## 什麼情況下該推翻它

- **暫停期間需要看進檢視器內部才做得出來的行為。** 例如「作答後點圖上被標出的某一處，說明卡就換成那一處」：這要做命中判定，而且只在標記裡判定。
  那時暫停才真的是檢視器的一個 stage。
- **只是作答後放開雙指與拖曳，讓人湊近看標記，不是推翻的理由。** `PAN` 與 `ZOOM` 不動 stage，
  一局在暫停時轉交這兩個 action、解除視野鎖定就做得到。`DOUBLE_TAP` 不能照這樣放開：
  它在閒著的檢視器上可能變成新的第一段，那才需要看進檢視器裡。
