"use client";

import { useEffect, useRef, useState } from "react";
import {
  layoutProgressOf,
  parseProgress,
  recordAnswer,
  type LayoutProgress,
  type Progress,
} from "@/lib/quiz/progress";
import type { Answer } from "@/lib/quiz/round";

// 學習進度在瀏覽器裡的那一半（PRD §6.6.1）：localStorage 的讀與寫。
// 紀錄長什麼樣、怎麼記一筆作答在 `lib/quiz/progress.ts`，這裡只負責把它放進去、拿出來——
// 與 `useFirstVisitHint` 同一條分工：`lib/` 是純的，平台的東西留在 `components/use*.ts`。

const PROGRESS_KEY = "fp:progress:v1";

/**
 * 讀不到就是空紀錄。瀏覽器封鎖儲存（無痕視窗、隱私設定）時，localStorage 的讀寫都會丟例外，
 * 而那個人照樣要能玩（spec user story 42）——只是不會被記住。
 *
 * `available` 另外說「讀不讀得到」：出題不在乎，當空紀錄就好；畫面在乎——只印一個 0 / 13，
 * 剛答對 7 題的人會以為網站壞了（M4 票 05，規格主人 2026-09-15 裁定）。
 */
function readProgress(): { progress: Progress; available: boolean } {
  try {
    return { progress: parseProgress(window.localStorage.getItem(PROGRESS_KEY)), available: true };
  } catch {
    return { progress: parseProgress(null), available: false };
  }
}

/**
 * 這張圖此刻的紀錄。**每次呼叫都重讀**：「再玩一次」要依剛打完那一局更新過的進度出題。
 * 不是 hook：出題發生在按下「開始」的那一刻，讀的就是那一刻的紀錄。
 */
export const loadLayoutProgress = (layoutId: string): LayoutProgress =>
  layoutProgressOf(readProgress().progress, layoutId);

/**
 * 畫面上要印的一張圖的紀錄，加上這台瀏覽器記不記得住。
 * `canRemember` 是 false 時，`progress` 是當成空的那一份，答過的題目也不會被記住——「你認得」旁邊要說出為什麼（`KnownCount`）。
 */
export type StoredProgress = { progress: LayoutProgress; canRemember: boolean };

function loadStoredProgress(layoutId: string): StoredProgress {
  const { progress, available } = readProgress();
  return { progress: layoutProgressOf(progress, layoutId), canRemember: available };
}

/**
 * 開場要印的紀錄（M4 票 05）。**client 接手之後**才有，在那之前是 null。
 *
 * null 是「還不知道」，與 `useFirstVisitHint` 的 `visible: null` 同一個理由：這個站是 SSG，靜態 HTML 是每個人共用的同一份，
 * 而答案在這台瀏覽器的 localStorage 裡。伺服器端先給一份空紀錄也是一種答案，但那是猜的——
 * 猜錯就是先印出「你認得 0 / 13」，再跳成真的數字。
 *
 * 開場的 `canRemember` 只看讀不讀得到。讀得到、寫不進去的瀏覽器（容量滿了）要寫一次才知道，開場不為了這句話先試寫一筆；
 * 那種瀏覽器在結算時才說（`useSaveAnswers`）。
 */
export function useLayoutProgress(layoutId: string): StoredProgress | null {
  const [stored, setStored] = useState<StoredProgress | null>(null);
  useEffect(() => setStored(loadStoredProgress(layoutId)), [layoutId]);
  return stored;
}

/**
 * 記一筆作答，回傳記住了沒。寫之前重讀整份紀錄，不拿開局時讀到的那一份改：
 * 同一台瀏覽器的另一個分頁可能在這之間寫過，拿舊的那份寫回去就把它蓋掉了。
 */
function saveAnswer(layoutId: string, answer: Answer): boolean {
  try {
    const next = recordAnswer(readProgress().progress, layoutId, answer, new Date());
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    return true;
  } catch {
    // 記不住就記不住：這一局照樣玩得完，只是下次不會記得。
    return false;
  }
}

/**
 * 一局每多一筆作答，**立刻**寫進學習進度（spec「學習進度」）：玩到一半離開，已經答的不白答。
 * 一局本身是純的、不碰 localStorage，所以由呼叫端把作答清單交進來。
 *
 * 記到第幾筆存在 ref 裡，不是「寫最後一筆」：開發時 Strict Mode 會重跑 effect，同一筆不能記兩次。
 * 呼叫端每開一局就換一個 key 重新掛上，ref 跟著從 0 開始。
 *
 * 回傳**寫完之後讀回來的**這張圖的紀錄（掛上時讀一次、之後每多一筆作答寫完再讀一次；第一次讀到之前是 null）。
 * 結算印的「你認得」就是它（M4 票 05）：讀排在同一個 effect 裡的寫後面，所以它一定已經算進這一局——
 * 靠的是這個先後，不是「結算那一輪 render 剛好晚於最後一筆寫入」。
 * 讀寫被封鎖時讀回來的是空紀錄：結算印的數字與「再玩一次」出題讀到的是同一份，不會各說各話。
 *
 * `canRemember`：讀不到，或這一局有任何一筆沒寫進去，就是 false——這一局沒有被完整記住。
 */
export function useSaveAnswers(layoutId: string, answers: Answer[]): StoredProgress | null {
  const saved = useRef(0);
  const failed = useRef(false);
  const [stored, setStored] = useState<StoredProgress | null>(null);
  useEffect(() => {
    for (; saved.current < answers.length; saved.current++) {
      if (!saveAnswer(layoutId, answers[saved.current])) failed.current = true;
    }
    const read = loadStoredProgress(layoutId);
    setStored(failed.current ? { ...read, canRemember: false } : read);
  }, [layoutId, answers]);
  return stored;
}
