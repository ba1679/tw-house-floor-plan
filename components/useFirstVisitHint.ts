"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 一次性引導的記憶（票 05）。這裡是檢視器唯一碰 localStorage 的地方——
// `lib/viewer/*` 是純的（不碰 DOM、不讀 document），平台的東西一律留在 `components/use*.ts`，
// 跟 useViewerGestures 同一層。
//
// key 照 PRD §6.6.1 的 `fp:progress:v1` 取：`fp:` 前綴圈出這個站的東西，尾碼是版本。
// 文案或呈現方式若在往後大改，換一個版本號就能讓所有人再看一次，不必去猜舊值代表什麼。
const SEEN_KEY = "fp:hint:tap:v1";

/**
 * localStorage 在瀏覽器封鎖儲存時，讀寫都可能丟例外。
 * 引導沒顯示是小事，整個檢視器掛掉是大事，所以兩邊都吞掉例外——
 * 讀不到就當作沒看過（寧可多說一次，不要因為讀不到就從此不說）。
 */
function hasSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // 記不住就記不住：代價只是下次再說一次。
  }
}

export type FirstVisitHint = {
  /**
   * `null` 是「還不知道」：這個站是 SSG，靜態 HTML 是第一次來的人與回訪的人**共用同一份**，
   * 而答案在瀏覽器的 localStorage 裡。伺服器端先寫死一個 false 也算一種答案，
   * 但那是猜的——猜錯就是回訪的人先看到引導再看它消失。
   */
  visible: boolean | null;
  /** 使用者的手指碰到圖了。 */
  dismiss: () => void;
};

export function useFirstVisitHint(): FirstVisitHint {
  const [visible, setVisible] = useState<boolean | null>(null);

  // Strict Mode 會重跑 effect；同一次掛載只判斷一次，避免讀到自己剛寫入的值。
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const seen = hasSeen();
    setVisible(!seen);
    // 「出現一次後就記住」——記在**出現的這一刻**，不是等使用者點下去。
    // 等點下去的話，看一眼就關掉分頁的人下次會再看到同一句話（user story 23）。
    if (!seen) markSeen();
  }, []);

  return {
    visible,
    dismiss: useCallback(() => setVisible(false), []),
  };
}
