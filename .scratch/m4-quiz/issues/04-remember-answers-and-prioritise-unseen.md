# 04: 答過的會被記住，下一局先考沒遇過的

**What to build:** 他第一局錯了管道間和浴缸。關掉網頁、明天再來，第二局出的是第一局沒考過的那 6 個，加上他錯過的其中一個——**打完兩局，13 個每一個都考過了**。之後每一局都先考他還不熟的。他改用無痕視窗玩，照樣能玩，只是不會被記住。

**Blocked by:** 01（要先有作答，才有東西可記）

**Status:** done

規格：`.scratch/m4-quiz/spec.md` 的「可出題符號、題數與出題」「學習進度」；PRD §6.3、§6.6.1。

## 注意

- **schema 不變**：key `fp:progress:v1`，`correct` / `wrong` 是 symbol id → 次數。`version` 不符整份丟棄重來，不寫遷移
- **每作答一題立刻寫入**，不等整局結束
- **答錯只記在題目的符號上，不記被點中的那一個**——點歪不等於不認得（`CONTEXT.md` 的熟悉度）
- **熟悉度只由次數算，不加欄位。** 紀錄裡有、但已經不是可出題符號的 id 一律忽略
- **出題順序**：還沒遇到 → 還不熟（依錯誤次數由多到少，同數隨機）→ 已認識（隨機），依層序填到題數，選出來的集合整局打亂
- 出題函式吃一個亂數來源：頁面傳 `Math.random`，測試傳固定序列
- **瀏覽器測試預塞進度時，只在 key 不存在才寫。** `addInitScript` 每次導航都重跑，無條件寫入的話，重新整理那一下會把 app 剛寫進去的紀錄蓋掉，「重新整理後紀錄還在」那條就會測到假的結果
- localStorage 讀寫丟例外（瀏覽器封鎖儲存）時當作空紀錄。M2 的首次引導已經有同樣的防護寫法，沿用它的測試手法

## Acceptance criteria

- [x] 答對 → `correct[題目]` +1；答錯 → `wrong[題目]` +1、`wrong[被點中的符號]` 不變；`updated_at` 更新
- [x] 答到第 3 題時重新整理 → 回到開場，前 2 題的紀錄已經在 localStorage
- [x] `version` 不符的紀錄視為空紀錄，第一次作答後寫回 `version: 1`
- [x] localStorage 被封鎖：一局走得完，不丟例外
- [x] 預塞「6 個還沒遇到 + 3 個還不熟（錯 3、2、1）+ 4 個已認識」→ 這一局的題目集合是那 6 個加上錯 3 次的那一個（只斷言集合，不斷言順序）
- [x] 純函式測試（node context、手寫小輸入、固定亂數序列）：還沒遇到先於還不熟先於已認識；還不熟依錯誤次數由多到少；某一層不夠時由下一層補；輸出沒有重複；紀錄裡不是可出題符號的 id 不會出成題目；同一個亂數序列下輸出穩定

## Comments

**2026-09-14：做完了。** node 測試 7 條、瀏覽器測試 6 條新增，找找看既有的測試維持綠，`npm run typecheck` 乾淨。

### 做了什麼

- **`lib/quiz/progress.ts`（純）**：`fp:progress:v1` 的形狀與四件事。
  - 讀：沒有紀錄、壞掉的 JSON、版本不符，一律是空紀錄。次數只收正的有限數字。
  - 記一筆作答：答對記在題目的 `correct`，答錯記在題目的 `wrong`，被點中的符號不記。
  - 熟悉度三態：程式裡叫 `known` / `missed` / `unseen`。
  - 取一張圖的紀錄：這張圖沒有紀錄時是空的。
- **`pickQuestions` 吃進度**：還沒遇到 → 還不熟（錯多的在前、同數隨機）→ 已認識，填到題數，再整局打亂。
- **`components/useLearningProgress.ts`**：localStorage 的讀與寫，丟例外時當作空紀錄。
  - 每一次讀寫都重讀整份紀錄：別的分頁剛寫過的不會被蓋掉。
- **找找看**：
  - 「開始」與「再玩一次」按下去的那一刻讀進度、出題（`loadLayoutProgress`）。
  - 一局每多一筆作答，就寫一筆（`useSaveAnswers`）。
- **測試**：
  - node：`tests/quiz-questions.spec.ts`。
  - 瀏覽器：`tests/quiz-progress.spec.ts`。
  - 瀏覽器測試的共用工具抽到 `tests/quiz-play.ts`：資料、定位、作答、預塞進度、`startRoundAt`（開一局並玩到指定題目）。
    `quiz-page.spec.ts` 改用它，測試本體一行未改。

### 小決定

- **`updated_at` 寫到日**，照 PRD §6.6.1 的例子。用本地日期：台灣早上八點以前，UTC 還是昨天。
- **多一條「空白紀錄連打兩局，考遍 13 個」**：這是票面那句話本身，把記帳、「再玩一次」與出題串起來走一次。
- **`startRoundAt` 靠這張的優先序決定題目**：除了目標以外全部塞成已認識，目標就一定在這一局。
  02 的測試要知道題目是誰（例如「題目柱、點牆」），用的就是它。

### 兩軸 review 之後改的

- **`components/progressStorage.ts` 改成 `components/useLearningProgress.ts`**：
  - 平台的東西留在 `components/use*.ts` 是 `useFirstVisitHint` 那裡寫下的規矩，原本的檔名不合。
  - 寫入的那個 effect 原本在 `QuizRound` 裡，讓那個元件多一個與畫面無關的改動理由。現在寫入是 `useSaveAnswers`。
  - 讀取仍是按下「開始」那一刻呼叫的 `loadLayoutProgress`：出題讀的就是那一刻的紀錄，不需要是 hook。

**2026-09-19：逐條對過 AC，補勾。** 結案時漏勾，不是沒驗：M2、M3 在結案的 commit 裡勾，M4 只改了 Status。
在 main（`25fa64a`）上全新 build 跑全套（`CI=1 PORT=3417 npx playwright test`，不重用 dev server）：227 條全綠；`npm run typecheck` 乾淨。
每一條 AC 對到的是**讀過本體、確認有斷言**的測試，不只看測試名稱：

1. `quiz-progress.spec.ts`「答對記在題目的 correct；答錯記在題目的 wrong，被點中的那個不記；updated_at 跟著更新」。
2. `quiz-progress.spec.ts`「答到第 3 題時重新整理」：另一張圖的紀錄也沒被弄掉。
3. `quiz-progress.spec.ts`「版本不符的紀錄視為空紀錄」。
4. `quiz-progress.spec.ts`「瀏覽器封鎖 localStorage：一局走得完、再玩一次也出得了題，不丟例外」。
5. `quiz-progress.spec.ts`「6 個還沒遇到 + 3 個還不熟（錯 3、2、1）+ 4 個已認識」：只比集合。
6. `quiz-questions.spec.ts`「一局出哪些題」七條：固定亂數序列，四組序列都要成立。
