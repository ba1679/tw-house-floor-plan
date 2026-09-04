"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { FloorPlanView } from "./FloorPlanView";
import type { FloorPlan, FloorPlanArtwork } from "@/lib/floorplan/types";
import { createViewerState, reduceViewer } from "@/lib/viewer/interaction";
import { canvasTransform, screenToPlan } from "@/lib/viewer/view";
import styles from "./FloorPlanViewer.module.css";

// PRD §10.1 的分層：Layout Data → SVG Renderer → Hotspot Layer → Interaction State → Info Panel。
// 這個元件是 Hotspot Layer 與 Interaction State 的接線處：它把使用者點在哪個 CSS 像素上
// 換算成圖面座標交給純狀態機，再把回傳的狀態畫成畫面。判斷邏輯一條都不在這裡。

type Props = {
  floorplan: FloorPlan;
  artwork: FloorPlanArtwork;
  /** symbol id → 名稱。畫面上的字取自 symbol 資料，不在元件裡寫死。 */
  symbolNames: Record<string, string>;
};

export function FloorPlanViewer({ floorplan, artwork, symbolNames }: Props) {
  const { viewBox } = artwork;
  const viewportRef = useRef<HTMLDivElement>(null);

  // 初始寬度先給一個占位值：zoom 1 的 transform 是 translate(0,0) scale(1)，
  // 與寬度無關，所以 SSR 出來的靜態頁面就已經是正確的全圖，掛載後不會跳動。
  const [state, dispatch] = useReducer(
    reduceViewer,
    { hotspots: floorplan.hotspots, viewBox, viewportWidth: 375 },
    createViewerState,
  );

  // 真正的寬度只有瀏覽器知道。它同時是 px ↔ cm 的比例尺，所以量錯就整條命中判定都錯。
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      dispatch({ type: "RESIZE", viewportWidth: entry.contentRect.width });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleTap = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const el = viewportRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const point = screenToPlan(state, event.clientX - box.left, event.clientY - box.top);
      dispatch({ type: "TAP", x: point.x, y: point.y });
    },
    [state],
  );

  const candidateIds = new Set(state.candidates.map((h) => h.id));
  const nameOf = (symbolId: string | null) =>
    (symbolId && symbolNames[symbolId]) || symbolId || "";

  return (
    <>
      <div
        ref={viewportRef}
        className={styles.viewport}
        style={{ aspectRatio: `${viewBox.width} / ${viewBox.height}` }}
        onClick={handleTap}
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

      <div className={styles.controls}>
        {state.stage !== "browsing" && (
          <button type="button" className={styles.reselect} onClick={() => dispatch({ type: "RESELECT" })}>
            重選
          </button>
        )}
      </div>

      <p className={styles.status} role="status">
        {state.stage === "confirmed"
          ? nameOf(state.selected?.symbol_id ?? null)
          : state.stage === "candidates"
            ? state.confirmMissed
              ? "還是沒點到。再點一次，或按「重選」退回第一段。"
              : `放大了，圈出 ${state.candidates.length} 個候選。再點一次確認你要的那一個。`
            : state.lastTap
              ? "這附近沒有可以點的東西，換個地方點點看。"
              : /* 還沒動過手：這裡的「可以點」引導是票 05 的事，它要配 localStorage
                   只出現一次。先放在這裡的話，回訪的人每次都會看到（user story 23）。 */
                ""}
      </p>
    </>
  );
}
