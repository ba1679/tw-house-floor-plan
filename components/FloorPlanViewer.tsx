"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { FloorPlanView } from "./FloorPlanView";
import { InfoSheet } from "./InfoSheet";
import { useViewerGestures } from "./useViewerGestures";
import type { FloorPlan, FloorPlanArtwork } from "@/lib/floorplan/types";
import type { SymbolRecord } from "@/lib/symbols/types";
import { createViewerState, reduceViewer, selectedOccurrence } from "@/lib/viewer/interaction";
import { canvasTransform, isFitView } from "@/lib/viewer/view";
import styles from "./FloorPlanViewer.module.css";

// PRD §10.1 的分層：Layout Data → SVG Renderer → Hotspot Layer → Interaction State → Info Panel。
// 這個元件是 Hotspot Layer 與 Interaction State 的接線處：它把使用者點在哪個 CSS 像素上
// 換算成圖面座標交給純狀態機，再把回傳的狀態畫成畫面。判斷邏輯一條都不在這裡。

type Props = {
  floorplan: FloorPlan;
  artwork: FloorPlanArtwork;
  /** symbol id → 該符號的內容。畫面上的字取自 symbol 資料，不在元件裡寫死。 */
  symbols: Record<string, SymbolRecord>;
};

export function FloorPlanViewer({ floorplan, artwork, symbols }: Props) {
  const { viewBox } = artwork;
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

  // 使用者發起的手勢：拖曳平移、雙指縮放、雙擊放大，以及「哪一下才算點擊」。
  const gestures = useViewerGestures(viewportRef, state, dispatch);

  const close = useCallback(() => dispatch({ type: "RESELECT" }), []);
  const nextOccurrence = useCallback(() => dispatch({ type: "NEXT_OCCURRENCE" }), []);
  const resetView = useCallback(() => dispatch({ type: "RESET_VIEW" }), []);

  const candidateIds = new Set(state.candidates.map((h) => h.id));
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
      <div
        id="floorplan-viewport"
        ref={viewportRef}
        className={styles.viewport}
        style={{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
        {...gestures}
      >
        <div
          className={styles.canvas}
          style={{ transform: canvasTransform(state) }}
        >
          <FloorPlanView floorplan={floorplan} artwork={artwork}>
            <g className={styles.hotspots} aria-hidden="true">
              {/* 第一段看了多大一圈。半徑用命中判定當下存下的 tolCmAtTap，**不在放大後重算**：
                  重算是拿 3× 的比例尺去換同樣的 46px，畫出來只有實際的三分之一，
                  圈外的熱區卻亮著。原型自己踩過這個坑。 */}
              {state.stage === "candidates" && state.lastTap && state.tolCmAtTap !== null && (
                <circle
                  id="tap-tolerance"
                  cx={state.lastTap.x}
                  cy={state.lastTap.y}
                  r={state.tolCmAtTap}
                />
              )}
              {state.hotspots.map((h) => (
                <rect
                  key={h.id}
                  id={h.id}
                  data-state={
                    state.selected?.id === h.id
                      ? "selected"
                      : candidateIds.has(h.id)
                        ? "candidate"
                        : "normal"
                  }
                  x={h.coords[0]}
                  y={h.coords[1]}
                  width={h.coords[2]}
                  height={h.coords[3]}
                />
              ))}
            </g>
          </FloorPlanView>
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
              : /* 還沒動過手：這裡的「可以點」引導是票 05 的事，它要配 localStorage
                   只出現一次。先放在這裡的話，回訪的人每次都會看到（user story 23）。 */
                ""}
      </p>

      {selectedSymbol && occurrence && (
        <InfoSheet
          symbol={selectedSymbol}
          symbols={symbols}
          occurrence={occurrence}
          onClose={close}
          onNextOccurrence={nextOccurrence}
        />
      )}
    </>
  );
}
