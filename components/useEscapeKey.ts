"use client";

import { useEffect } from "react";

// Esc 在檢視器與找找看裡的意思都是「退一步」：第二段進行中退回第一段、說明卡開著時關卡。
//
// 掛在 window 上而不是某個元素上：焦點可能在熱區上、在卡片裡、或在「重選」那顆按鈕上，
// 而 Esc 在這幾個地方的意思是同一件事。

/**
 * `active` 時按 Esc 就呼叫 `onEscape`；不 active 時不掛監聽。
 * `onEscape` 要是同一個函式物件（useCallback），否則每一輪 render 都會拆掉重掛一次。
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onEscape]);
}
