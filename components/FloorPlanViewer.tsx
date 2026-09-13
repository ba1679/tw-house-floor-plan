"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FloorPlanRenderer, type RoomState } from "./FloorPlanRenderer";
import { HighlightFromQuery } from "./HighlightFromQuery";
import { InfoSheet } from "./InfoSheet";
import { useFirstVisitHint } from "./useFirstVisitHint";
import { useViewerGestures } from "./useViewerGestures";
import { planViewBox } from "@/lib/floorplan/drawing";
import { roomOfHotspot, type RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import type { SymbolRecord } from "@/lib/symbols/types";
import { createViewerState, reduceViewer, selectedOccurrence } from "@/lib/viewer/interaction";
import { canvasTransform, isFitView } from "@/lib/viewer/view";
import styles from "./FloorPlanViewer.module.css";

// PRD §10.1 的分層：Layout Data → SVG Renderer → Hotspot Layer → Interaction State → Info Panel。
// 這個元件是 Hotspot Layer 與 Interaction State 的接線處：它把使用者點在哪個 CSS 像素上
// 換算成圖面座標交給純狀態機，再把回傳的狀態畫成畫面。判斷邏輯一條都不在這裡。

/**
 * 第一次進站的那一句話（PRD §6.1.2 v0.5）。它刻意不說「點擊圖上的標記」——
 * 那句話要求使用者點準一個比指尖還小的東西，而兩段式存在的理由正是拆掉這個預設。
 */
const TAP_HINT = "點圖上任何一個位置，我們會放大讓你看清楚";

type Props = {
  floorplan: FloorPlan;
  /** symbol id → 該符號的內容。畫面上的字取自 symbol 資料，不在元件裡寫死。 */
  symbols: Record<string, SymbolRecord>;
  /**
   * 熱區依「依房間、房間內依類別」排好（票 06）。**熱區按這個順序進 DOM，焦點與讀螢幕
   * 都跟著 DOM 走**，不靠 tabindex 排號碼；正的 tabindex 一旦出現，之後每加一個可聚焦的
   * 東西都要回頭重編一次全站的號碼。
   *
   * 在 build 時算好（`lib/floorplan/reading-order.ts`），這裡只負責畫。
   */
  readingOrder: RoomHotspots[];
};

export function FloorPlanViewer({ floorplan, symbols, readingOrder }: Props) {
  // 圖面與命中判定必須在同一個座標系裡，所以 viewBox 只有一份算法
  // （`lib/floorplan/drawing.ts` 的 `planViewBox`），renderer 與狀態機各自去問它。
  const viewBox = planViewBox(floorplan);
  const viewportRef = useRef<HTMLDivElement>(null);

  // 初始尺寸先給一個占位值：zoom 1 的 transform 是 translate(0,0) scale(1)，
  // 與尺寸無關，所以 SSR 出來的靜態頁面就已經是正確的全圖，掛載後不會跳動。
  const [state, dispatch] = useReducer(
    reduceViewer,
    {
      hotspots: floorplan.hotspots,
      viewBox,
      viewportWidth: 375,
      viewportHeight: (375 * viewBox.height) / viewBox.width,
    },
    createViewerState,
  );

  // 真正的尺寸只有瀏覽器知道。寬度同時是 px ↔ cm 的比例尺，所以量錯就整條命中判定都錯；
  // 高度則是說明卡升起來之後圖能用的那條可視帶（票 03 決議 3）。
  // 兩個數字來自**同一次觀測的同一個框**——不是分兩處各量一次。
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      dispatch({
        type: "RESIZE",
        viewportWidth: entry.contentRect.width,
        viewportHeight: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 找找看（M4）的視野鎖定。M2 沒有 UI 打開它（spec「為 M4 預留的介面」），而它擋得住
  // 什麼、擋不住什麼是這張票的驗收條件之一，所以留一個網址參數當入口：`?fitLocked=1`。
  // M4 接上遊戲狀態時改成在該處派同一個 action，狀態機不必回頭改。
  useEffect(() => {
    const locked = new URLSearchParams(window.location.search).get("fitLocked") === "1";
    dispatch({ type: "SET_FIT_LOCKED", locked });
  }, []);

  // 從符號頁按轉換點進來的人（`?symbol=`，M3 票 08）：那個符號在圖上的每一處一起亮。
  // 網址由 `HighlightFromQuery` 讀，它自己待在一個 Suspense 邊界裡——理由寫在那個元件上。
  const highlightSymbol = useCallback(
    (symbolId: string) => dispatch({ type: "HIGHLIGHT_SYMBOL", symbolId }),
    [],
  );

  // 使用者發起的手勢：拖曳平移、雙指縮放、雙擊放大，以及「哪一下才算點擊」。
  const gestures = useViewerGestures(viewportRef, state, dispatch);

  // 「這張圖可以點」的一次性引導（票 05）。只有第一次進站的人看得到。
  const hint = useFirstVisitHint();
  const { dismiss } = hint;
  // 引導在**手指碰到圖的那一刻**收起來，不等 TAP 派出去——拖曳與雙指也算碰到。
  // 使用者已經發現這張圖會回應他，那句話就沒有事情可做了；接下來狀態列要說的是
  // 「圈出了幾個候選」這種當下的事。
  const { onPointerDown: startGesture } = gestures;
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      dismiss();
      // 手指一碰到圖，鍵盤那條路就結束了。少了這一行，用鍵盤開過卡片的人改用手指點圖時，
      // 下一張卡片會把焦點搶進去，關掉之後又跳回一個他根本沒碰過的熱區、順便把圖平移過去。
      setKeyboardOrigin(null);
      startGesture(event);
    },
    [dismiss, startGesture],
  );
  // 覆寫寫在同一個物件裡，不是在 JSX 上疊第二個 onPointerDown：
  // 疊的那種寫法對屬性順序敏感，有人調換一次就把 dismiss 靜靜地弄丟了。
  const viewportHandlers = { ...gestures, onPointerDown };

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

  const close = useCallback(() => {
    dispatch({ type: "RESELECT" });
    if (keyboardOrigin) document.getElementById(keyboardOrigin)?.focus();
    setKeyboardOrigin(null);
  }, [keyboardOrigin]);
  const nextOccurrence = useCallback(() => dispatch({ type: "NEXT_OCCURRENCE" }), []);
  const resetView = useCallback(() => dispatch({ type: "RESET_VIEW" }), []);

  // 焦點走到畫面外的熱區時，圖跟著移過去（票 06）。id 從事件的 currentTarget 拿，
  // 不是替 37 個熱區各做一個 closure。
  const focusHotspot = useCallback((event: ReactFocusEvent<SVGRectElement>) => {
    dispatch({ type: "FOCUS_HOTSPOT", id: event.currentTarget.id });
  }, []);

  // Enter（與 role="button" 一併要求的 Space）直接開說明卡：鍵盤不走兩段式。
  const activateHotspot = useCallback((event: ReactKeyboardEvent<SVGRectElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setKeyboardOrigin(event.currentTarget.id);
    dispatch({ type: "SELECT_HOTSPOT", id: event.currentTarget.id });
  }, []);

  // Esc 退回上一步：說明卡開著就關卡片，第二段進行中就退回第一段——兩者本來就是同一個 action。
  // 掛在 window 上而不是卡片上：焦點可能在卡片裡、在熱區上、或在「重選」那顆按鈕上，
  // 而 Esc 在這三個地方的意思是同一件事。
  useEffect(() => {
    if (state.stage === "browsing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.stage, close]);

  const candidateIds = new Set(state.candidates.map((h) => h.id));

  /**
   * 說明卡開著時，**沒被選到的房間暗下去**（票 07）。
   *
   * 說明卡是版面裡的一格（票 03），它升起來就把平面圖壓成一條可視帶。在那條帶子裡
   * 「我現在看的東西在哪一間」是最容易掉的一件事，所以把其餘房間退成背景。
   * 兩段式進行中不做——那時該亮的是候選，多一層明暗只是雜訊。
   *
   * 這是圖面第一次依互動狀態改變畫法。做得到這件事，正是這一層從產生器的靜態產物
   * 換成 React renderer 的理由（`docs/adr/0005`）；M4 找找看要的「把某個房間變暗」走同一條路。
   */
  const focusedRoomId =
    state.stage === "confirmed" && state.selected
      ? roomOfHotspot(readingOrder, state.selected.id)
      : null;
  // useMemo 不是為了省這幾行的計算，是為了**同一個物件**：平移的每一次 pointermove
  // 都會重畫一輪，而圖面那一層靠 props 沒變才跳得過去（`PlanArtwork` 的 memo）。
  // 每輪新做一個內容相同的物件，等於那層 memo 不存在。
  const roomStates = useMemo<Record<string, RoomState> | undefined>(
    () =>
      focusedRoomId
        ? Object.fromEntries(
            floorplan.rooms
              .filter((room) => room.id !== focusedRoomId)
              .map((room) => [room.id, "muted" as const]),
          )
        : undefined,
    [focusedRoomId, floorplan.rooms],
  );

  const selectedSymbol = state.selected?.symbol_id
    ? (symbols[state.selected.symbol_id] ?? null)
    : null;
  const occurrence = selectedOccurrence(state);
  const nameOf = (symbolId: string | null) =>
    (symbolId && symbols[symbolId]?.name) || symbolId || "";

  const controls =
    state.stage === "candidates" ? (
      <button type="button" className={styles.control} onClick={close}>
        重選
      </button>
    ) : state.stage === "browsing" && !isFitView(state) ? (
      <button type="button" className={styles.control} onClick={resetView}>
        回到全圖
      </button>
    ) : null;

  return (
    <>
      {/* 邊界只包住這個什麼都不畫的元件，不包整個檢視器：包在外面的話，圖就從靜態 HTML 裡消失了。 */}
      <Suspense fallback={null}>
        <HighlightFromQuery onSymbol={highlightSymbol} />
      </Suspense>
      <div
        id="floorplan-viewport"
        ref={viewportRef}
        className={styles.viewport}
        style={{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
        {...viewportHandlers}
      >
        <div
          className={styles.canvas}
          style={{ transform: canvasTransform(state) }}
        >
          <FloorPlanRenderer floorplan={floorplan} roomStates={roomStates}>
            {/* aria-hidden 在票 06 拿掉了：這一層現在是這張圖讀得出來的那一版。 */}
            <g
              id="hotspot-layer"
              className={styles.hotspots}
              data-hint={hint.visible === null ? undefined : hint.visible ? "on" : "off"}
              data-stage={state.stage}
            >
              {/* 第一段看了多大一圈。半徑用命中判定當下存下的 tolCmAtTap，**不在放大後重算**：
                  重算是拿 3× 的比例尺去換同樣的 46px，畫出來只有實際的三分之一，
                  圈外的熱區卻亮著。原型自己踩過這個坑。 */}
              {state.stage === "candidates" && state.lastTap && state.tolCmAtTap !== null && (
                <circle
                  id="tap-tolerance"
                  cx={state.lastTap.x}
                  cy={state.lastTap.y}
                  r={state.tolCmAtTap}
                  aria-hidden="true"
                />
              )}
              {/* DOM 的順序就是焦點走過的順序，所以熱區依房間分段、依閱讀順序畫（票 06）。
                  一間房一個 <g>：讀螢幕的人聽得到自己走到哪一間，而 data-room 讓測試
                  問得出「頁面自己說這個熱區屬於哪一間」，不必在測試裡把演算法再寫一次。 */}
              {readingOrder.map((room) => (
                <g
                  key={room.roomId}
                  role="group"
                  data-room={room.roomId}
                  aria-label={room.roomName}
                >
                  {room.hotspots.map((h) => (
                    <rect
                      key={h.id}
                      id={h.id}
                      role="button"
                      tabIndex={0}
                      aria-label={nameOf(h.symbol_id)}
                      onFocus={focusHotspot}
                      onKeyDown={activateHotspot}
                      data-state={
                        state.selected?.id === h.id
                          ? "selected"
                          : candidateIds.has(h.id)
                            ? "candidate"
                            : h.symbol_id === state.highlightedSymbol
                              ? "highlighted"
                              : "normal"
                      }
                      x={h.coords[0]}
                      y={h.coords[1]}
                      width={h.coords[2]}
                      height={h.coords[3]}
                    />
                  ))}
                </g>
              ))}
            </g>
          </FloorPlanRenderer>
        </div>
      </div>

      {/* 這一列一次只養得起一顆按鈕：它一出現就從平面圖那條可視帶挖走 56px。
          - candidates：「重選」是退出第二段的路，這時最需要它。
          - browsing 且視野不是全圖：使用者自己放大或平移過，「回到全圖」才有事情做。
          - confirmed：「重選」由說明卡的關閉鍵擔任（關卡片＝回到 browsing，是同一個
            action，票 03），而卡片開著時可視帶本來就只剩一條，不再擺第二顆按鈕。 */}
      {controls && <div className={styles.controls}>{controls}</div>}

      <p className={styles.status} role="status">
        {state.stage === "confirmed"
          ? nameOf(state.selected?.symbol_id ?? null)
          : state.stage === "candidates"
            ? state.confirmMissed
              ? "還是沒點到。再點一次，或按「重選」退回第一段。"
              : `放大了，圈出 ${state.candidates.length} 個候選。再點一次確認你要的那一個。`
            : state.lastTap
              ? "這附近沒有可以點的東西，換個地方點點看，或連點兩下放大這一區。"
              : hint.visible
                ? TAP_HINT
                : ""}
      </p>

      {selectedSymbol && occurrence && (
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
