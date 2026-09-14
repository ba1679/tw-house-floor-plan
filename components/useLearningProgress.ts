"use client";

import { useEffect, useRef } from "react";
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
 */
function readProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_KEY));
  } catch {
    return parseProgress(null);
  }
}

/**
 * 這張圖此刻的紀錄。**每次呼叫都重讀**：「再玩一次」要依剛打完那一局更新過的進度出題。
 * 不是 hook：出題發生在按下「開始」的那一刻，讀的就是那一刻的紀錄。
 */
export const loadLayoutProgress = (layoutId: string): LayoutProgress =>
  layoutProgressOf(readProgress(), layoutId);

/**
 * 記一筆作答。寫之前重讀整份紀錄，不拿開局時讀到的那一份改：
 * 同一台瀏覽器的另一個分頁可能在這之間寫過，拿舊的那份寫回去就把它蓋掉了。
 */
function saveAnswer(layoutId: string, answer: Answer): void {
  try {
    const next = recordAnswer(readProgress(), layoutId, answer, new Date());
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // 記不住就記不住：這一局照樣玩得完，只是下次不會記得。
  }
}

/**
 * 一局每多一筆作答，**立刻**寫進學習進度（spec「學習進度」）：玩到一半離開，已經答的不白答。
 * 一局本身是純的、不碰 localStorage，所以由呼叫端把作答清單交進來。
 *
 * 記到第幾筆存在 ref 裡，不是「寫最後一筆」：開發時 Strict Mode 會重跑 effect，同一筆不能記兩次。
 * 呼叫端每開一局就換一個 key 重新掛上，ref 跟著從 0 開始。
 */
export function useSaveAnswers(layoutId: string, answers: Answer[]): void {
  const saved = useRef(0);
  useEffect(() => {
    for (; saved.current < answers.length; saved.current++) {
      saveAnswer(layoutId, answers[saved.current]);
    }
  }, [layoutId, answers]);
}
