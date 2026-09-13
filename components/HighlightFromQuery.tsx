"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { HIGHLIGHT_PARAM } from "@/lib/viewer/highlight";

/**
 * 讀網址上的 `?symbol=`，交給檢視器（M3 票 08）。**它什麼都不畫。**
 *
 * 獨立成一個元件，是為了讓它**自己**待在一個 Suspense 邊界裡。`output: "export"` 之下沒有伺服器
 * 看得到 query，呼叫 `useSearchParams` 的元件在預先渲染時，會把「往上到最近的 Suspense 邊界」
 * 那一整段改成只在瀏覽器裡渲染：
 *  - 沒有邊界：build 直接失敗（Next 的 missing-suspense-with-csr-bailout）。
 *  - 邊界包在整個檢視器外面：build 會過，但靜態 HTML 裡就沒有圖了——SSG 出來的全圖、
 *    掛載後不跳動（`FloorPlanViewer` 的初始尺寸那一段）全部作廢。
 * 包住這個什麼都不畫的元件，被改成瀏覽器渲染的就只有它自己。
 *
 * 不像 `?fitLocked=1` 那樣在 effect 裡讀 `window.location`：從符號頁按下去是 `<Link>` 的
 * client 端換頁，網址什麼時候換好由 router 決定；`useSearchParams` 是 router 自己交出來的那一份。
 */
export function HighlightFromQuery({ onSymbol }: { onSymbol: (symbolId: string) => void }) {
  const symbolId = useSearchParams().get(HIGHLIGHT_PARAM);

  useEffect(() => {
    if (symbolId) onSymbol(symbolId);
  }, [symbolId, onSymbol]);

  return null;
}
