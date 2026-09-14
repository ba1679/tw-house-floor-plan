"use client";

import { Suspense, useCallback, useEffect, useReducer, useState } from "react";
import { FloorPlanViewport, initialViewerConfig } from "./FloorPlanViewport";
import { HighlightFromQuery } from "./HighlightFromQuery";
import { InfoSheet } from "./InfoSheet";
import { useFirstVisitHint } from "./useFirstVisitHint";
import { isSymbolAbsent } from "@/lib/floorplan/hotspots";
import type { RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import type { SymbolRecord } from "@/lib/symbols/types";
import { SYMBOL_NOT_FOUND, TAP_HINT, absentSymbolBanner, highlightStatus } from "@/lib/ui/copy";
import {
  createViewerState,
  occurrencesOf,
  reduceViewer,
  selectedOccurrence,
} from "@/lib/viewer/interaction";
import styles from "./FloorPlanViewer.module.css";

// 平面圖頁的檢視器：**自由看圖**。圖框本身（手勢、畫布、熱區層）在 `FloorPlanViewport`，
// 這裡是自由看圖自己的那一側——持有狀態機、讀網址帶進來的高亮、樑的橫幅、說明卡（docs/adr/0007）。

type Props = {
  floorplan: FloorPlan;
  /** symbol id → 該符號的內容。畫面上的字取自 symbol 資料，不在元件裡寫死。 */
  symbols: Record<string, SymbolRecord>;
  /** 熱區的閱讀順序，在 build 時算好（`lib/floorplan/reading-order.ts`）。見 `FloorPlanViewport`。 */
  readingOrder: RoomHotspots[];
};

export function FloorPlanViewer({ floorplan, symbols, readingOrder }: Props) {
  // 初始尺寸是占位值，SSR 出來的靜態頁面就已經是正確的全圖（`initialViewerConfig`）。
  const [state, dispatch] = useReducer(reduceViewer, floorplan, (fp: FloorPlan) =>
    createViewerState(initialViewerConfig(fp)),
  );

  // 視野鎖定的網址參數 `?fitLocked=1`：M2 替還不存在的找找看留的測試入口。
  // 找找看已經在一局開始時打開同一個開關（`lib/quiz/round.ts` 的 `createRound`），
  // 這個入口只剩「網址加一個參數就把圖鎖死、畫面上又沒有東西解得開」的副作用——M4 票 07 拆掉。
  useEffect(() => {
    const locked = new URLSearchParams(window.location.search).get("fitLocked") === "1";
    dispatch({ type: "SET_FIT_LOCKED", locked });
  }, []);

  // 從符號頁按轉換點進來的人（`?symbol=`，M3 票 08）：那個符號在圖上的每一處一起亮。
  // 網址由 `HighlightFromQuery` 讀，它自己待在一個 Suspense 邊界裡——理由寫在那個元件上。
  //
  // **對不到任何符號的 id 不交給狀態機**（規格主人 2026-09-13 的決定 D4）：網址打錯或剪壞了，
  // 狀態列說一聲找不到就好。擋在這裡，狀態機的 `highlightedSymbol` 永遠是一個真的符號——
  // 「高亮了、但圖上 0 處」因此只會是樑那一種（票 09），不會混進一個打錯的網址。
  //
  // 用 `Object.hasOwn` 而不是「查不查得到」：`symbols` 是一個普通物件，`symbols["constructor"]`
  // 查得到 Object 原型上的東西，會被當成一個真的符號。
  const [symbolNotFound, setSymbolNotFound] = useState(false);

  /**
   * 帶進來的符號在這張圖上 0 處時，是哪一個——橫幅說的就是它（樑，M3 票 09）。留到使用者自己關掉為止。
   *
   * **不掛在狀態機的 `highlightedSymbol` 上**：那一欄在使用者開始選東西時就清掉（docs/adr/0006），
   * 而橫幅要在兩段式點擊照常進行時留著。也不進 `ViewerState`：狀態機裡沒有任何判斷讀它——命中、stage、
   * 視野都與它無關。它是畫面上的一條說明，與「找不到網址指定的符號」那一句是同一種東西。
   *
   * 0 處由 `isSymbolAbsent` 判斷，與符號頁決定按鈕要不要說「看不到」是同一個判斷：按鈕說看不到，進來就有這條橫幅。
   */
  const [absentSymbol, setAbsentSymbol] = useState<string | null>(null);
  const highlightSymbol = useCallback(
    (symbolId: string) => {
      if (!Object.hasOwn(symbols, symbolId)) {
        setSymbolNotFound(true);
        return;
      }
      dispatch({ type: "HIGHLIGHT_SYMBOL", symbolId });
      if (isSymbolAbsent(floorplan.hotspots, symbolId)) setAbsentSymbol(symbolId);
    },
    [symbols, floorplan.hotspots],
  );

  // 「這張圖可以點」的一次性引導（票 05）。只有第一次進站的人看得到。
  const hint = useFirstVisitHint();

  /**
   * 說明卡是從哪個熱區用鍵盤打開的。關掉卡片時焦點要回到那裡——
   * 不然使用者得從第一間房重新 Tab 一次才能接著看下一個符號。
   *
   * 只有鍵盤那條路會記：用手指點開卡片的人沒有焦點可還，而替他把焦點搬進卡片、
   * 再搬回一個他看不見焦點框的熱區，只會讓讀螢幕的游標莫名其妙地跳。
   *
   * 是 state 不是 ref：它要參與渲染（決定卡片開起來時收不收焦點），
   * 而 render 期間讀 ref 讀到的是「上一次改到哪」，不是這一輪該畫的東西。
   */
  const [keyboardOrigin, setKeyboardOrigin] = useState<string | null>(null);

  const onTouch = useCallback(() => {
    // 「找不到網址指定的符號」與引導同一個時機退場：那一句的話也說完了。
    setSymbolNotFound(false);
    // 手指一碰到圖，鍵盤那條路就結束了。少了這一行，用鍵盤開過卡片的人改用手指點圖時，
    // 下一張卡片會把焦點搶進去，關掉之後又跳回一個他根本沒碰過的熱區、順便把圖平移過去。
    setKeyboardOrigin(null);
  }, []);

  const onKeyboardSelect = useCallback((hotspotId: string) => {
    setKeyboardOrigin(hotspotId);
    // 選定了一個熱區，「找不到網址指定的符號」那一句也說完了——不收的話，關掉卡片回到 browsing 時它又冒出來。
    setSymbolNotFound(false);
  }, []);

  const close = useCallback(() => {
    dispatch({ type: "RESELECT" });
    if (keyboardOrigin) document.getElementById(keyboardOrigin)?.focus();
    setKeyboardOrigin(null);
  }, [keyboardOrigin]);
  const nextOccurrence = useCallback(() => dispatch({ type: "NEXT_OCCURRENCE" }), []);

  const selectedSymbol = state.selected?.symbol_id
    ? (symbols[state.selected.symbol_id] ?? null)
    : null;
  const occurrence = selectedOccurrence(state);
  /** 說明卡此刻升起來了沒。掛上 `<InfoSheet>`、樑的橫幅讓位、房間變暗，問的是同一件事，所以只寫一次。 */
  const sheetOpen = selectedSymbol !== null && occurrence !== null;

  // Esc 關掉說明卡——與關閉鍵同一個 action。第二段進行中的 Esc 由圖框自己處理。
  // 掛在 window 上而不是卡片上：焦點可能在卡片裡、也可能還在熱區上，而 Esc 在兩個地方的意思是同一件事。
  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen, close]);

  const nameOf = (symbolId: string | null) =>
    (symbolId && symbols[symbolId]?.name) || symbolId || "";

  /**
   * 落地時狀態列說的那一句（M3 票 08；規格主人 2026-09-13 的決定 D2、D4）。
   *
   * 讀螢幕的人看不到圖亮起來，而狀態列是 role="status"，它說的話會被唸出來；看得見的人也從「共 N 處」確認
   * 全部都亮了。處數由 hotspots 算（`occurrencesOf`，與說明卡的「共 N 處」同一個算法）。
   * **對到 0 處時不說**——那是樑，由橫幅接手（票 09）。
   */
  const highlightTotal = occurrencesOf(state, state.highlightedSymbol).length;
  const landingLine = symbolNotFound
    ? SYMBOL_NOT_FOUND
    : highlightTotal > 0
      ? highlightStatus(nameOf(state.highlightedSymbol), highlightTotal)
      : "";
  // 第一次進站的引導不讓位給落地那一句，接在它後面（決定 D2）：從符號頁進來的人
  // 多半是第一次打開平面圖，而引導一出現就記成看過——讓位的話他從此聽不到它。
  const restingStatus =
    state.stage === "confirmed"
      ? nameOf(state.selected?.symbol_id ?? null)
      : `${landingLine}${hint.visible ? TAP_HINT : ""}`;

  /**
   * 樑的那條橫幅此刻畫不畫（M3 票 09）。**說明卡升起時讓位**，收起來就回來——讓位不是關掉，關掉只有使用者自己按。
   *
   * 橫幅是版面裡的一列，它拿走的是高度。全圖時拿走的是留白（375 × 812 下框一 px 都沒少），而卡片一升起，
   * 可視帶本來就只剩一條，再拿走一列就是從圖上挖：量過 334.7px → 231.3px，展開時 187.7px → 84.3px。
   * 與頁尾讓位是同一個理由（`SiteFooter.module.css`）。
   */
  const banner =
    absentSymbol && !sheetOpen
      ? absentSymbolBanner(floorplan.name, nameOf(absentSymbol))
      : null;

  return (
    <>
      {/* 邊界只包住這個什麼都不畫的元件，不包整個檢視器：包在外面的話，圖就從靜態 HTML 裡消失了。 */}
      <Suspense fallback={null}>
        <HighlightFromQuery onSymbol={highlightSymbol} />
      </Suspense>
      {/* 帶進來的符號在這張圖上 0 處（樑，M3 票 09）：圖的正上方一條說明，說它為什麼不在圖上。
          **在框的外面，不疊在圖上**：疊上去會蓋掉一塊圖，而且落在手勢的範圍裡——點橫幅會被當成點圖。
          不開說明卡：他剛在符號頁讀完同樣的內容，而說明卡是綁著「選中了某個熱區」才開的。 */}
      {banner && (
        <div id="absent-symbol-banner" className={styles.banner}>
          <p className={styles.bannerText}>
            <span className={styles.bannerLead}>{banner.lead}</span>
            {banner.reason}
          </p>
          {/* 只有使用者自己關得掉它：開始選東西、縮放、開關說明卡都不收——那些都不代表他讀過了。 */}
          <button type="button" className={styles.bannerDismiss} onClick={() => setAbsentSymbol(null)}>
            {banner.dismiss}
          </button>
        </div>
      )}

      <FloorPlanViewport
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder}
        viewer={state}
        dispatch={dispatch}
        dimRooms={sheetOpen}
        restingStatus={restingStatus}
        hint={hint}
        onTouch={onTouch}
        onKeyboardSelect={onKeyboardSelect}
      />

      {sheetOpen && (
        <InfoSheet
          symbol={selectedSymbol}
          symbols={symbols}
          occurrence={occurrence}
          takeFocus={keyboardOrigin !== null}
          onClose={close}
          onNextOccurrence={nextOccurrence}
        />
      )}
    </>
  );
}
