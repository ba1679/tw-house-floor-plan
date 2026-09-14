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
// 與 `useFirstVisitHint` 同一條分工：`lib/` 是純的，平台的東西留在 components。

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
 */
export const loadLayoutProgress = (layoutId: string): LayoutProgress =>
  layoutProgressOf(readProgress(), layoutId);

/**
 * 記一筆作答，**立刻寫入**（spec「學習進度」）：玩到一半離開，已經答的不白答。
 *
 * 寫之前重讀整份紀錄，不拿開局時讀到的那一份改：同一台瀏覽器的另一個分頁可能在這之間寫過，
 * 拿舊的那份寫回去就把它蓋掉了。
 */
export function saveAnswer(layoutId: string, answer: Answer): void {
  try {
    const next = recordAnswer(readProgress(), layoutId, answer, new Date());
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // 記不住就記不住：這一局照樣玩得完，只是下次不會記得。
  }
}
