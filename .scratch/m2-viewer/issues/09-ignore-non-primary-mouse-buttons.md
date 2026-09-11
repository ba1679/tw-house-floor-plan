# 09: 排除滑鼠右鍵與中鍵的檢視器手勢

**Status:** done
**Priority:** P2
**Type:** bug
**Related:** 04（pan/zoom）
**Review baseline:** `b5015cc`，2026-09-08

## 問題與影響

由 `onClick` 改成 pointer 手勢後，`components/useViewerGestures.ts` 的 `onPointerDown`
沒有過濾滑鼠按鍵。右鍵也進入手勢 session，放開會派出點擊，移動則可能派出平移。
桌機使用者只是開啟瀏覽器右鍵選單，檢視器卻同時放大並改變候選狀態。

## 重現步驟

1. 開啟 `/layouts/3b2l_standard`，等圖面載入完成。
2. 在大門 `hs-door-entry` 中心按一次滑鼠右鍵。
3. 觀察圖面倍率與候選狀態。

Review 實測：右鍵點大門會圈出 3 個候選並放大。正常預期是檢視器不處理此按鍵，
保留瀏覽器原有右鍵行為。中鍵走同一條未過濾路徑，修正時一併驗證。

## 修正方向

在開始手勢記帳與 pointer capture 之前排除非主鍵的滑鼠輸入。
不要一律排除非 primary pointer：第二根觸控手指仍必須加入 session，才能維持 pinch zoom。
不以全面阻止 `contextmenu` 取代按鍵過濾。

## 驗收條件

- [x] 右鍵點擊大門不改變視野、候選或已選取的符號。
- [x] 中鍵點擊，以及右鍵／中鍵拖曳，不觸發檢視器的 TAP、DOUBLE_TAP 或 PAN 行為。
- [x] 滑鼠主鍵的兩段式、拖曳與雙擊仍正常。
- [x] 單指點擊／拖曳及雙指縮放仍正常，尤其第二根觸控手指不可被過濾。
- [x] 使用真實瀏覽器輸入測試外部行為；既有說明卡、兩段式、pan/zoom 測試通過。

## Comments

2026-09-08：Codex 唯讀 review 重現右鍵誤觸。當時相關既有測試 27/27 通過，未涵蓋非主鍵輸入。本票僅記錄問題，尚未修改程式碼。

**2026-09-11 — 修好了。**`tests/pan-zoom.spec.ts` 加一條，全套 67 條綠。

`components/useViewerGestures.ts` 的 `onPointerDown` 開頭一行：
`if (event.pointerType === "mouse" && event.button !== 0) return;`
擋在手勢記帳與 `setPointerCapture` 之前——抓住了指標卻不打算處理它，右鍵選單就開不出來。

**濾按鍵，不濾 `isPrimary`。** 第二根觸控手指的 `isPrimary` 也是 false，濾掉它就沒有雙指縮放了
（`pinch` 那兩條測試會當場變紅）。限定 `pointerType === "mouse"` 而不是只看 `button`：
觸控與筆按下時 `button` 一律是 0，這一行本來就碰不到它們，寫明是為了讀的人不必再推一次。

沒有去 `preventDefault` `contextmenu`：右鍵選單是瀏覽器的東西，這裡只是不插手。

**按著主鍵時再按右鍵不會漏掉半個 session。** Pointer Events 規格裡 `pointerdown` 只在
「從沒有按鍵按下轉為有按鍵按下」時發，中途換按鍵走的是 `pointermove`；
被擋掉的那一下之後如果真的來了 `pointerup`，`endContact` 也會因為 `pointers` 裡沒有這個 id 而直接返回。
