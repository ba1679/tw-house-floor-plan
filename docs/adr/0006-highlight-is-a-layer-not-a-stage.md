---
status: accepted
date: 2026-09-13
---

# 高亮是疊在 browsing 上的一層，不是第四個 stage

從符號頁按轉換點進平面圖（`/layouts/<id>?symbol=<symbol>`，M3 票 08），那個符號在圖上的每一處
同時是 `highlighted`。狀態機的做法是 `ViewerState` 多一欄 `highlightedSymbol`、多一個
`HIGHLIGHT_SYMBOL` action（`lib/viewer/interaction.ts`）。**`Stage` 仍然只有
`browsing` / `candidates` / `confirmed` 三個**，高亮期間 stage 是 `browsing`。

## 為什麼這值得寫下來

三個條件都滿足：

- **難逆**：高亮住在哪裡決定了 reducer 裡每一個 case 怎麼寫，建好之後要改就得回頭動整個狀態機。
- **會被問**：「高亮」聽起來像一種模式，而這個檢視器的「模式」就是 stage。下一個讀程式的人會問為什麼它不是一個。
- **有一個具體被拒絕的替代方案**：複用 `candidates`。而它被拒絕的理由很容易寫錯（見下）。

## 考慮過的替代方案

1. **第四個 stage（`highlighting`）。** 放棄的理由是高亮期間該有的行為**全部**是 browsing 的行為：
   自由縮放與拖曳、直接點圖開始新的第一段、鍵盤 Tab 走熱區、「回到全圖」那顆按鈕。多一個 stage，
   每一個看 stage 分流的地方——`tap()`、`DOUBLE_TAP`、`RESELECT`、`RESIZE`、控制列、Esc、
   熱區提示的 CSS（`[data-stage="browsing"]`）——都得回答「highlighting 算不算 browsing」，
   而答案每一處都是「算」。M4 接手時狀態機會多一個只是換了名字的 browsing（spec user story 40）。

2. **把那個符號的熱區塞進 `candidates`。**

   **拒絕的理由不是命中判定會出錯。** 那條路其實不會壞：`tap()` 看 stage 分流
   （`stage === "candidates"` 才走 `confirmTap`），stage 既然維持 browsing，第二段的 30px 判定
   永遠不會接管，下一次點擊會用第一段的容錯半徑重算候選集並把它覆蓋掉。

   真正會壞的是**畫面與語意**。檢視器的 `data-state` 只看「在不在候選集裡」、不看 stage
   （`components/FloorPlanViewer.tsx`），塞進去的熱區會被畫成 `candidate`——與真正的第一段候選
   在畫面上完全無法分辨，而使用者其實沒有點過任何東西。`CONTEXT.md` 把 `highlighted` 與
   `candidate` / `selected` 分開登錄、明講不可互相概括，這一條是在兌現那句話。

   把正確的理由寫下來，是這份 ADR 最主要的工作。照「命中判定會出錯」去讀的人，只要驗證一次
   命中判定沒壞，就會以為可以推翻它——而他推翻的是一個從來不是理由的理由。

3. **存熱區清單而不是 symbol id。** 放棄：這個符號在圖上有哪幾處，hotspots 已經答得出來
   （`occurrencesOf`，說明卡的「共 N 處」也是這樣算），另存一份就多一份會跟它分岔的名單。
   對到 0 處（樑）因此是一個合法的值，不是錯誤。

   **但這一欄不是票 09 橫幅的現成載體。** 它點一下就清掉，而票 09 的橫幅要在兩段式點擊照常進行時留著、
   直到使用者自己關掉。橫幅要不要另外記、記在哪裡，是票 09 的決定。

## 什麼時候清掉

| 動作 | 高亮 | 理由 |
|---|---|---|
| 點圖上任一處（`TAP`） | 清 | 使用者一動手點圖，就是開始自己看了。點在亮著的熱區上也一樣——那是新的第一段，不是確認 |
| 鍵盤 Enter（`SELECT_HOTSPOT`） | 清 | 與手指的第二段同一件事：使用者自己選定了一個熱區。清在 `confirmSelection` |
| 鍵盤 Tab（`FOCUS_HOTSPOT`） | 留 | 只是焦點在走，還沒選定任何東西。撕掉會讓他失去剛從符號頁帶進來的脈絡 |
| 雙指縮放、拖曳、回到全圖 | 留 | 使用者要自己湊近看某一處（spec user story 16） |
| 框的寬度變了（`RESIZE`） | 留 | 候選在寬度變動時作廢，是因為它們是用舊的 px↔cm 比例尺挑的；高亮是一個 symbol，不依賴比例尺。落地後的第一次 `RESIZE`（量到真正的框）就是這一種 |

視野在落地時維持全圖，**不自動放大**：9 扇窗散在全圖，放大只會藏起其中幾處。

## 後果

- **雙擊之後高亮是清掉的，而這一點還沒定案。** 手勢層把雙擊的第一下當成一次點擊送出
  （`components/useViewerGestures.ts`），要到第二下才認得出那是雙擊，而第一下已經照 spec「任何 `TAP` 清掉高亮」
  清掉了高亮。放大照常，但放大之後圖上什麼都不亮了：想湊近看某一扇窗的人，用雙指縮放留得住高亮，
  用雙擊留不住——與 spec user story 16 互相拉扯。現狀照 spec 的字面做；`tests/conversion-point.spec.ts`
  只釘「雙擊照樣放大」，**刻意不釘高亮清不清**，留給規格的主人決定（M3 票 08 的 Comments）。
- **讀網址的元件自己待在一個 Suspense 邊界裡**（`components/HighlightFromQuery.tsx`）。
  `output: "export"` 之下 `useSearchParams` 要求一個邊界；而邊界包在整個檢視器外面的話，
  build 照樣會過、瀏覽器裡照樣會亮，壞掉的是靜態 HTML——圖整個不在裡面。
- **高亮只有畫面，狀態列不說話。** 讀螢幕的人落地時聽不到「亮了 9 處」。狀態列那一格在落地時
  屬於第一次進站的引導（票 05），兩者怎麼分那一格，留給規格的主人（M3 票 08 的 Comments）。

## 什麼情況下該推翻它

- 高亮期間需要一套 browsing **沒有**的行為——例如「高亮時點圖，只在亮著的熱區裡選」。那時它才真的是一個階段。
- 規格的主人決定雙擊不該清掉高亮（見「後果」第一條）。那時要改的是 `tap()` 清掉高亮的條件
  （例如沒有圈出任何候選的那一下不清），不是把高亮升成一個 stage。
