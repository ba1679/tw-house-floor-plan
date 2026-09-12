# 01: 解開 `verified` 的 `caution` 閘門

**What to build:** 內容維護者把一個符號標成「查證完成」時，就算這個符號沒有「注意事項」，建置也要通過。

**Blocked by:** None (can start immediately)

**Status:** done

規格：`.scratch/m3-symbol-pages/spec.md` 的「要改的那一條」。

## 為什麼這張排第一

M1（內容查證）與 M3 並行中，而 `REQUIRED_WHEN_VERIFIED` 目前含 `caution`——14 筆符號裡**只有雨遮有 `caution`**。後果是 M1 一把任何符號翻成 `verified`，資料驗證就失敗 → `prebuild` 失敗 → 建置斷掉 → M3 全部的頁面測試一起掛（測試的 webServer 跑的是 `npm run build && npm run start`）。

它同時讓查證率的上限變成 **1/14 = 7%**，M1 的 80% 門檻在算術上不可能達成。

這張票沒有 blocker，但**不是「可以先做」而是「必須先做」**：晚一天就多一天讓 M1 把建置線弄斷的機會。

## 決策

`caution` 不該綁進查證完備性。`verification_status` 描述的是「**來源查證**做到哪」，而 `caution`（買房時要注意什麼）需要的是另一類來源——建築技術規則、防火門 A/B 分級、採光通風規定這種**法規**，與畫法來源是兩回事，不能從製圖規範推導（資料自己的 `_meta.content_state` 已經這樣寫，型別也把它宣告成可為 null）。

留著它等於宣告「沒有法規注意事項的符號就不算查證完成」，那是把兩條軸混成一條——`CONTEXT.md` 對 `source_tier` 與 `verification_status` 警告過同一件事。

`verified_at` 與 `verified_by` **維持必填**：它們記錄「誰在什麼時候查的」，那正是查證這件事本身。

- [x] `caution` 為 `null` 的符號標成 `verified`（並填 `verified_at` / `verified_by`），資料驗證通過、退出碼 0
- [x] `verified_at` 或 `verified_by` 為空卻標 `verified` 時，建置**仍然失敗**——這不是把整條檢查放掉
- [x] 上面兩條各有一個測試，沿用既有的 sandbox 手法（複製資料與腳本到 tmp 再改壞，**不得動到 repo 裡的真資料**）
- [x] 錯誤訊息說明**為什麼**這條規則存在，不只說哪裡錯（延續既有驗證器的風格）
- [x] 既有的 67 條測試維持綠

## Comments

**2026-09-12 — 做完了。**全套 **70** 條綠（既有 67 + 新增 3）、`npm run typecheck` 乾淨、真資料
`npm run validate` 0 errors、1 warning（樑那條預期中的）。真資料一個字都沒動——查證率還是
1/14 = 7%，翻牌是 M1 的事，這張票只是把門打開。

`scripts/validate_data.py` 的 `REQUIRED_WHEN_VERIFIED` 拿掉 `caution`，剩
`plain_meaning` / `source_refs` / `verified_at` / `verified_by`。

**它從 list 改成 dict：欄位與它的理由寫在同一行。**錯誤訊息因此一個欄位一句自己的理由，
例如「`wall`: 標記 verified 但 `verified_at` 為空——verified 要記得這筆查證是什麼時候做的，
缺了日期就看不出它有多舊」。共用一句會退化成「這些欄位就是要填」，而那正是 `caution` 當初
混進來沒被擋下的原因：清單裡的每一項都說不出自己為什麼在清單裡。

（第一版寫成「清單」＋「理由表」兩份常數，review 指出那是兩份要手工同步的東西——往清單加一個
欄位卻忘了加理由，會是 `KeyError` 炸在驗證器裡，而不是一條說得清楚的驗證錯誤。併成一份。）

順手補的兩處，都是**這次改動自己造成的不一致**，不是擴大範圍：
- 同一個 `verified` 區塊裡的 `source_tier` 檢查原本只說哪裡錯。改完之後四條訊息說得出為什麼、
  它不行，而它就在隔一行
- 區塊標題與報告那行的「內容完整」是舊規則的說法，改成「查證紀錄完整」

測試在 `tests/build-validation.spec.ts` 的 `verified 的閘門` describe 底下，沿用既有 sandbox：

- **不寫死符號 id。**`verifiedWithoutCaution()` 從資料裡找第一個 `caution` 為 `null` 的符號、
  填齊查證紀錄，**只改記憶體裡那份，寫檔留給呼叫的人**——跟這個檔案其餘九條測試同一個手法。
  找不到就帶訊息失敗（「這個測試的前提已經不成立」）。寫死 `wall` 的話，M1 哪天給牆補了 `caution`，
  這條測試會默默變成在測「有 `caution` 的符號能不能 verified」：還是綠的，但守的已經不是原來那件事
- **「仍然失敗」那條拆成兩個 `test()`**（`verified_at`、`verified_by` 各一），不是一個迴圈塞在
  同一條裡。迴圈的前一圈失敗後一圈就不跑，而這兩個欄位是兩個獨立的行為。票上寫「各有一個測試」，
  這裡是 1 + 2 = 3 條
- 每一輪**只蓋掉一個欄位**，另一個留著填好的值——才證明是「缺這一個」擋下來的，不是兩個一起缺才擋
- **理由斷言釘各自那一句**（`缺了日期就看不出它有多舊` / `缺了人就沒有人能被問起它`），
  不釘共用的半句。只釘共用的那半句等於允許訊息退回「這些欄位就是要填」
- fixture 用 `2026-01-01` / `build-validation-fixture`，不用真的日期與人名——延續檔裡
  `wall-999`、`3b2l_renamed` 那種一眼看得出是假值的慣例

**紅過才綠，而且在 sandbox 裡反向驗過三種回歸**，確認每一條測試是真的在守東西：

| 打進去的回歸 | 結果 | 哪一條會紅 |
|---|---|---|
| `caution` 加回閘門 | 退出碼 1 | 測試一（斷言 0） |
| `verified_at` 不再必填 | 退出碼 0 | 測試二（斷言非 0） |
| 訊息退回「只說哪裡錯」 | 退出碼 1、訊息不含理由 | 測試二的理由斷言 |

另外確認兩個欄位的理由各自只配對到自己（缺 `verified_at` 的輸出不含 `verified_by` 那一句）。

**`CONTEXT.md` 的「Verification Status」補上這條規則。**`CLAUDE.md` 要求「詞彙進 `CONTEXT.md`」，
而放寬建置閘門是 M1 整條線都踩在上面的事實，只活在 Python 註解裡不夠。那條條目現在寫明
`verified` 要求的是查證紀錄齊全、`caution` 不在其中，`_Avoid_` 也加了「把 `caution` 算成查證完備性的一部分」。

**沒寫 ADR。**這是一條可逆的驗證規則，理由完整留在 spec 的「要改的那一條」、常數上方的註解與
上面那條 `CONTEXT.md` 條目；它兌現的是 `CONTEXT.md` 早就登錄的「兩條軸」，沒有新詞彙。
（spec 認定值得寫 ADR 的是票 08 的「高亮是疊層而不是第四個 stage」。）

### 留給 M1 的一個觀察（不在這張票的範圍）

review 的 Standards 軸指出：測試一取到的 `wall` 是 `convention`、`source_refs` 只有 1 筆，
而 PRD §7.1 步驟 5 要求 `convention` 補**第 2 個交叉來源**才算查證完成。驗證器從來沒檢查過
`source_refs` 的筆數，所以這條測試等於順帶斷言了「1 筆也能 verified」。

**這次刻意不補那條檢查**：spec 已經逐條列出 M3 要加的三條建置檢查（必填欄位非空、
`related_layouts` 對得到 layout、`category` 收窄到三類），筆數不在其中；而這張票的工作是
**開一道門**，不是順手關上另一道。那條規則的歸屬是 M1——它要先決定「第 2 個交叉來源」
在資料裡長什麼樣（是 `source_refs` 多一筆，還是要標記哪一筆是交叉來源），驗證器才擋得住。
