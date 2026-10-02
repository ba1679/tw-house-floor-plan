"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { FloorPlanRenderer, type RoomState } from "./FloorPlanRenderer";
import { useEscapeKey } from "./useEscapeKey";
import type { FirstVisitHint } from "./useFirstVisitHint";
import { useViewerGestures } from "./useViewerGestures";
import { planViewBox } from "@/lib/floorplan/drawing";
import { roomsWith, type RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import { symbolName } from "@/lib/symbols/name";
import type { SymbolRecord } from "@/lib/symbols/types";
import {
  BLANK_TAP_STATUS,
  CONFIRM_MISSED_STATUS,
  VIEWER_CONTROLS,
  candidatesStatus,
  neutralHotspotLabel,
} from "@/lib/ui/copy";
import type { ViewerAction, ViewerConfig, ViewerState } from "@/lib/viewer/interaction";
import { checkMark, focusRing, revealedCorners, selectedFrame } from "@/lib/viewer/marks";
import { canvasTransform, isFitView } from "@/lib/viewer/view";
import styles from "./FloorPlanViewer.module.css";

// PRD §10.1 的分層：Layout Data → SVG Renderer → Hotspot Layer → Interaction State → Info Panel。
// 這個元件是 Hotspot Layer 與 Interaction State 的接線處：它把使用者點在哪個 CSS 像素上
// 換算成圖面座標交給純狀態機，再把回傳的狀態畫成畫面。判斷邏輯一條都不在這裡。
//
// **它不持有狀態機**（docs/adr/0007）。自由看圖（`FloorPlanViewer`）與找找看各自持有自己的 reducer、
// 再把狀態與 dispatch 交進來：找找看要在檢視器的狀態機外面包一層「一局」，這個框若自己 useReducer，
// 那一層就無從包起。說明卡、網址高亮、題目與回饋也都不在這裡——它們是呼叫端的事。

/**
 * 檢視器狀態機的初始設定，自由看圖與找找看都從這裡拿。
 *
 * 圖面與命中判定必須在同一個座標系裡，所以 viewBox 只有一份算法（`planViewBox`），renderer 與狀態機各自去問它。
 * 尺寸先給一個占位值：zoom 1 的 transform 是 translate(0,0) scale(1)，與尺寸無關，
 * 所以 SSR 出來的靜態頁面就已經是正確的全圖，掛載後不會跳動；真正的框由掛載後的 RESIZE 量。
 * 兩頁各寫一份的話，占位值只改了一邊，兩頁在量到真正的框之前的比例尺就不一樣。
 */
export function initialViewerConfig(floorplan: FloorPlan): ViewerConfig {
  const viewBox = planViewBox(floorplan);
  return {
    hotspots: floorplan.hotspots,
    viewBox,
    viewportWidth: 375,
    viewportHeight: (375 * viewBox.height) / viewBox.width,
  };
}

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
  /** 檢視器的狀態機由呼叫端持有（見檔頭）。 */
  viewer: ViewerState;
  dispatch: Dispatch<ViewerAction>;
  /**
   * 此刻標成 `selected` 的熱區。自由看圖是檢視器的 `selected`；找找看作答之後是被點中的那一個——
   * 那時檢視器已經退回閒著，被點中的是哪一個由一局記著（docs/adr/0007「標記住在結束它的那一層」）。
   */
  selectedHotspot: string | null;
  /** 找找看答對時，位於 selected 熱區右上外側的答對勾；其餘時間為 null。 */
  correctHotspot?: string | null;
  /** 此刻標成 `revealed` 的符號：找找看作答之後的題目符號，它在圖上的每一處。自由看圖永遠是 null。 */
  revealedSymbol: string | null;
  /**
   * 圖暫停中：找找看作答之後、按「下一題」之前。擋 action 的是一局，這裡只管畫——
   * 檢視器那時是閒著的 browsing，而 browsing 那層「這裡可以點」的提示在一張點不動的圖上不該亮起來
   * （docs/adr/0007「後果」）。
   */
  paused: boolean;
  /**
   * 熱區的替代文字念不念符號名字（M4 票 03）。
   * - `all`：自由看圖。每一個熱區念自己的符號名字。
   * - `marked`：找找看。只有圖上標成 `selected` 或 `revealed` 的念名字，其餘念「房間名 · 第 k 個可以點的東西」。
   *   作答之前圖上沒有任何標記，整張圖都不念；作答之後放開的只有這一題的那幾個——全部放開的話，
   *   Tab 一圈就知道這一局後面題目在哪（spec「作答之前不露名字」）。
   *
   * **是二選一，不是「給我每個熱區的替代文字」的函式**：誰念名字跟著圖上的標記走，只在這裡決定一次。
   * 收函式的話，每個呼叫端各自決定誰露名字，「作答後只放開這一題的」這條規矩就散到頁面各處去了。
   */
  names: "all" | "marked";
  /** 說明卡此刻升起來了沒。升起來時，沒有標記的房間暗下去。 */
  dimRooms: boolean;
  /** 兩段式沒在進行時（不在第二段、也不是剛點到空白處），狀態列說這一句。 */
  restingStatus: string;
  /** 「這張圖可以點」的一次性引導（票 05）。hook 由呼叫端呼叫——狀態列那一句要不要接上它，是呼叫端決定的。 */
  hint: FirstVisitHint;
  /** 自由看圖將控制整合到操作提示列，避免縮放後新增一列而改變圖框；找找看保留內建控制列。 */
  showControls?: boolean;
  /** 手指碰到圖了。呼叫端各自有要跟著收掉的東西。 */
  onTouch?: () => void;
  /** 鍵盤在這個熱區上按了 Enter／空白鍵（選定它的 action 已經派出去了）。 */
  onKeyboardSelect?: (hotspotId: string) => void;
};

export function FloorPlanViewport({
  floorplan,
  symbols,
  readingOrder,
  viewer,
  dispatch,
  selectedHotspot,
  correctHotspot = null,
  revealedSymbol,
  paused,
  names,
  dimRooms,
  restingStatus,
  hint,
  showControls = true,
  onTouch,
  onKeyboardSelect,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);

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
  }, [dispatch]);

  // 使用者發起的手勢：拖曳平移、雙指縮放、雙擊放大，以及「哪一下才算點擊」。
  const gestures = useViewerGestures(viewportRef, viewer, dispatch);

  const { dismiss } = hint;
  // 引導在**手指碰到圖的那一刻**收起來，不等 TAP 派出去——拖曳與雙指也算碰到。
  // 使用者已經發現這張圖會回應他，那句話就沒有事情可做了；接下來狀態列要說的是
  // 「圈出了幾個候選」這種當下的事。
  const { onPointerDown: startGesture } = gestures;
  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      dismiss();
      onTouch?.();
      startGesture(event);
    },
    [dismiss, onTouch, startGesture],
  );
  // 覆寫寫在同一個物件裡，不是在 JSX 上疊第二個 onPointerDown：
  // 疊的那種寫法對屬性順序敏感，有人調換一次就把 dismiss 靜靜地弄丟了。
  const viewportHandlers = { ...gestures, onPointerDown };

  const reselect = useCallback(() => dispatch({ type: "RESELECT" }), [dispatch]);
  const resetView = useCallback(() => dispatch({ type: "RESET_VIEW" }), [dispatch]);

  // 焦點走到畫面外的熱區時，圖跟著移過去（票 06）。id 從事件的 currentTarget 拿，
  // 不是替 37 個熱區各做一個 closure。
  const focusHotspot = useCallback(
    (event: ReactFocusEvent<SVGRectElement>) => {
      dispatch({ type: "FOCUS_HOTSPOT", id: event.currentTarget.id });
    },
    [dispatch],
  );

  // Enter（與 role="button" 一併要求的 Space）直接選定：鍵盤不走兩段式。
  const activateHotspot = useCallback(
    (event: ReactKeyboardEvent<SVGRectElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const { id } = event.currentTarget;
      onKeyboardSelect?.(id);
      dispatch({ type: "SELECT_HOTSPOT", id });
    },
    [dispatch, onKeyboardSelect],
  );

  // Esc 在第二段進行中退回第一段。說明卡開著時的 Esc 是呼叫端的事——卡片是它的。
  useEscapeKey(viewer.stage === "candidates", reselect);

  const candidateIds = new Set(viewer.candidates.map((h) => h.id));
  // 答對的勾只跟著 selected 出現。
  const correct =
    correctHotspot !== null && correctHotspot === selectedHotspot
      ? floorplan.hotspots.find((h) => h.id === correctHotspot)
      : undefined;

  /**
   * 說明卡開著時，**沒有標記的房間暗下去**（票 07；M4 票 02 放寬成「有標記」）。
   *
   * 說明卡是版面裡的一格（票 03），它升起來就把平面圖壓成一條可視帶。在那條帶子裡
   * 「我現在看的東西在哪一間」是最容易掉的一件事，所以把其餘房間退成背景。
   * 兩段式進行中不做——那時該亮的是候選，多一層明暗只是雜訊。
   *
   * 亮著的是有 `selected` 或 `revealed` 熱區的每一間。自由看圖只有 `selected`，結果就是「被選到的那一間」；
   * 找找看答錯時，被點中的與題目符號多半不在同一間——只亮被點中的那一間，題目符號所在的房間反而被壓暗。
   * 沒有任何標記落在房間裡時不壓暗。
   *
   * 這是圖面第一次依互動狀態改變畫法。做得到這件事，正是這一層從產生器的靜態產物
   * 換成 React renderer 的理由（`docs/adr/0005`）。
   *
   * useMemo 不是為了省這幾行的計算，是為了**同一個物件**：平移的每一次 pointermove
   * 都會重畫一輪，而圖面那一層靠 props 沒變才跳得過去（`PlanArtwork` 的 memo）。
   * 每輪新做一個內容相同的物件，等於那層 memo 不存在。依賴全是平移時不會變的值。
   */
  const roomStates = useMemo<Record<string, RoomState> | undefined>(() => {
    if (!dimRooms) return undefined;
    const lit = new Set(
      roomsWith(readingOrder, (h) => h.id === selectedHotspot || h.symbol_id === revealedSymbol),
    );
    if (lit.size === 0) return undefined;
    return Object.fromEntries(
      floorplan.rooms.filter((room) => !lit.has(room.id)).map((room) => [room.id, "muted" as const]),
    );
  }, [dimRooms, selectedHotspot, revealedSymbol, readingOrder, floorplan.rooms]);

  const controls =
    viewer.stage === "candidates" ? (
      <button type="button" className={styles.control} onClick={reselect}>
        {VIEWER_CONTROLS.reselect}
      </button>
    ) : viewer.stage === "browsing" && !isFitView(viewer) ? (
      <button type="button" className={styles.control} onClick={resetView}>
        {VIEWER_CONTROLS.resetView}
      </button>
    ) : null;

  return (
    <>
      <div
        id="floorplan-viewport"
        ref={viewportRef}
        className={styles.viewport}
        style={{ aspectRatio: `${viewer.viewBox.width} / ${viewer.viewBox.height}` }}
        {...viewportHandlers}
      >
        <div className={styles.canvas} style={{ transform: canvasTransform(viewer) }}>
          <FloorPlanRenderer floorplan={floorplan} roomStates={roomStates}>
            {/* aria-hidden 在票 06 拿掉了：這一層現在是這張圖讀得出來的那一版。 */}
            <g
              id="hotspot-layer"
              className={styles.hotspots}
              data-hint={hint.visible === null ? undefined : hint.visible ? "on" : "off"}
              data-stage={viewer.stage}
              data-paused={paused ? "true" : undefined}
            >
              {/* 第一段看了多大一圈。半徑用命中判定當下存下的 tolCmAtTap，**不在放大後重算**：
                  重算是拿 3× 的比例尺去換同樣的 46px，畫出來只有實際的三分之一，
                  圈外的熱區卻亮著。原型自己踩過這個坑。 */}
              {viewer.stage === "candidates" && viewer.lastTap && viewer.tolCmAtTap !== null && (
                <circle
                  id="tap-tolerance"
                  cx={viewer.lastTap.x}
                  cy={viewer.lastTap.y}
                  r={viewer.tolCmAtTap}
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
                  {room.hotspots.map((h, index) => {
                    // 優先序 selected > candidate > revealed > highlighted > normal。
                    // 後三者不會同時出現在同一張圖上（高亮只在自由看圖、revealed 只在找找看），
                    // 排這個順序只是讓同一條式子兩頁都能用。
                    const state =
                      h.id === selectedHotspot
                        ? "selected"
                        : candidateIds.has(h.id)
                          ? "candidate"
                          : h.symbol_id === revealedSymbol
                            ? "revealed"
                            : h.symbol_id === viewer.highlightedSymbol
                              ? "highlighted"
                              : "normal";
                    // `marked` 時念名字的就是畫上標記的那幾個，問的是同一個 state，不另外比一次 id：
                    // 兩處各比各的，哪天優先序一改，念出名字的與畫出標記的就對不上。
                    // k 從 1 起，是它在這一間房裡的閱讀順序——讀螢幕的人聽到的「第幾個」就是 Tab 走到它的先後。
                    const named = names === "all" || state === "selected" || state === "revealed";
                    const frame = state === "selected" ? selectedFrame(h.coords, viewer) : null;
                    // 記號與焦點環都是 aria-hidden 的 <path>，跟著熱區放在同一個 <g>：
                    // 焦點環靠 CSS 的 `g:has(> rect:focus-visible)` 找到自己的熱區。
                    return (
                      <g key={h.id}>
                        <rect
                          id={h.id}
                          role="button"
                          tabIndex={0}
                          aria-label={
                            named
                              ? symbolName(symbols, h.symbol_id)
                              : neutralHotspotLabel(room.roomName, index + 1)
                          }
                          onFocus={focusHotspot}
                          onKeyDown={activateHotspot}
                          data-state={state}
                          x={h.coords[0]}
                          y={h.coords[1]}
                          width={h.coords[2]}
                          height={h.coords[3]}
                        />
                        {frame && (
                          <>
                            <path className={styles.selectedCasing} d={frame.casing} aria-hidden="true" />
                            <path
                              className={styles.selectedLine}
                              data-mark="selected"
                              d={frame.line}
                              aria-hidden="true"
                            />
                          </>
                        )}
                        {state === "revealed" && (
                          <>
                            <path
                              className={styles.revealedCasing}
                              d={revealedCorners(h.coords, viewer)}
                              aria-hidden="true"
                            />
                            <path
                              className={styles.revealedMark}
                              data-mark="revealed"
                              d={revealedCorners(h.coords, viewer)}
                              aria-hidden="true"
                            />
                          </>
                        )}
                        <path className={styles.focusLight} d={focusRing(h.coords, viewer)} aria-hidden="true" />
                        <path className={styles.focusDark} d={focusRing(h.coords, viewer)} aria-hidden="true" />
                      </g>
                    );
                  })}
                </g>
              ))}
              {/* 答對的勾畫在所有熱區之後：疊放順序是「State 的線 → 答對的勾 → 鍵盤焦點」，
                  放進熱區自己的 <g> 的話，DOM 裡排在後面的熱區會把它蓋掉。 */}
              {correct && (
                <g aria-hidden="true">
                  <path className={styles.checkCasing} d={checkMark(correct.coords, viewer)} />
                  <path className={styles.checkMark} data-mark="check" d={checkMark(correct.coords, viewer)} />
                </g>
              )}
            </g>
          </FloorPlanRenderer>
        </div>
      </div>

      {/* 這一列一次只養得起一顆按鈕：它一出現就從平面圖那條可視帶挖走 56px。
          - candidates：「重選」是退出第二段的路，這時最需要它。
          - browsing 且視野不是全圖：使用者自己放大或平移過，「回到全圖」才有事情做。
          - confirmed：「重選」由說明卡的關閉鍵擔任（關卡片＝回到 browsing，是同一個
            action，票 03），而卡片開著時可視帶本來就只剩一條，不再擺第二顆按鈕。 */}
      {showControls && controls && <div className={styles.controls}>{controls}</div>}

      <p className={styles.status} role="status">
        {viewer.stage === "candidates"
          ? viewer.confirmMissed
            ? CONFIRM_MISSED_STATUS
            : candidatesStatus(viewer.candidates.length)
          : viewer.stage === "browsing" && viewer.lastTap
            ? BLANK_TAP_STATUS
            : restingStatus}
      </p>
    </>
  );
}
