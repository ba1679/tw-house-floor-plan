"use client";

import { useCallback, useRef, type Dispatch, type PointerEvent, type RefObject } from "react";
import type { ViewerAction, ViewerState } from "@/lib/viewer/interaction";
import { screenToPlan } from "@/lib/viewer/view";

// 手勢層：把 pointer 事件翻成狀態機聽得懂的 action（票 04）。
// 這裡只回答「手指在做什麼」——拖曳、雙指、點一下、點兩下；
// 「那件事會造成什麼結果」一律在 lib/viewer/interaction.ts，這個檔不做任何判定。
//
// 為什麼不是 onClick：手指按下、滑了 60px 再放開，click 事件照樣會發，而那顯然不是
// 「點這裡」的意思。分辨這件事需要按下的位置與滑動的距離，只有 pointer 事件給得出來。

/** 超過這個距離就是拖曳，放開時不再算成一次點擊（CSS px）。 */
const DRAG_SLOP_PX = 8;
/** 兩下之間短於這個時間、且落點相距在 DOUBLE_TAP_SLOP_PX 之內，才是一次雙擊。 */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 30;

type Point = { x: number; y: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** 事件的頁面座標 → 相對可視區域左上角的 CSS px。換算層講的「螢幕座標」就是這個。 */
const local = (el: HTMLDivElement, event: PointerEvent): Point => {
  const box = el.getBoundingClientRect();
  return { x: event.clientX - box.left, y: event.clientY - box.top };
};

/**
 * 一次接觸從按下到放開之間的全部記帳。它每一格都在改，而且改的頻率是每秒六十次以上——
 * 放進 React state 會讓每一次 pointermove 多走一輪 render，平移就跟不上手指了。
 */
type Session = {
  /** 目前壓在畫面上的手指（或滑鼠游標），依 pointerId。 */
  pointers: Map<number, Point>;
  /** 單指按下的位置。命中判定用它、不用放開的位置——按下去的地方才是使用者瞄準的地方。 */
  origin: Point | null;
  /** 已經平移到哪裡。跨過門檻之前不更新，第一次平移才補得回門檻前的那一小段。 */
  panned: Point | null;
  /** 這一次接觸已經被判定成拖曳（或多指），放開時不發 TAP。 */
  dragging: boolean;
  /** 雙指：上一格的指距與中點。 */
  pinch: { gap: number; mid: Point } | null;
  /**
   * 上一次點擊的時間與位置，用來認雙擊。名字刻意不叫 lastTap：
   * `ViewerState.lastTap` 是**圖面公分**，這一份是**螢幕 CSS px**，
   * 兩個單位共用一個名字正是這個 repo 壞過兩次的方式（CONTEXT.md「View」）。
   */
  lastContact: { at: number; point: Point } | null;
};

export function useViewerGestures(
  viewportRef: RefObject<HTMLDivElement | null>,
  state: ViewerState,
  dispatch: Dispatch<ViewerAction>,
) {
  // 手勢的回呼活得比一次 render 久，而換算螢幕座標要用「此刻」的視野。
  // 存一份鏡子，就沒有「拿上一輪的視野去換算這一下點在哪裡」的機會。
  const latest = useRef(state);
  latest.current = state;

  const session = useRef<Session>({
    pointers: new Map(),
    origin: null,
    panned: null,
    dragging: false,
    pinch: null,
    lastContact: null,
  });

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    if (!el) return;
    const g = session.current;
    const point = local(el, event);
    g.pointers.set(event.pointerId, point);
    // 抓住這根手指：滑出可視區域之外仍然收得到 move 與 up，
    // 少了它，往圖外拖一半就會斷在半路，畫面停在一個沒人放開的姿勢。
    el.setPointerCapture(event.pointerId);

    if (g.pointers.size === 1) {
      g.origin = point;
      g.panned = point;
      g.dragging = false;
      g.pinch = null;
      return;
    }

    // 第二根手指落下：這一次接觸不可能再是點擊了，接下來走雙指縮放。
    const [a, b] = [...g.pointers.values()];
    g.pinch = { gap: distance(a, b), mid: midpoint(a, b) };
    g.dragging = true;
  }, [viewportRef]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const el = viewportRef.current;
    const g = session.current;
    if (!el || !g.pointers.has(event.pointerId)) return;
    const point = local(el, event);
    g.pointers.set(event.pointerId, point);

    if (g.pinch) {
      const [a, b] = [...g.pointers.values()];
      const gap = distance(a, b);
      const mid = midpoint(a, b);
      if (g.pinch.gap > 0) {
        // 指距的比例是縮放，中點的位移是平移。兩指一邊撐開一邊移動時兩者同時發生，
        // 只做縮放的話圖會從手指底下溜走。
        dispatch({ type: "ZOOM", factor: gap / g.pinch.gap, anchor: g.pinch.mid });
        dispatch({ type: "PAN", dx: mid.x - g.pinch.mid.x, dy: mid.y - g.pinch.mid.y });
      }
      g.pinch = { gap, mid };
      return;
    }

    if (!g.origin || !g.panned) return;
    if (!g.dragging && distance(point, g.origin) > DRAG_SLOP_PX) g.dragging = true;
    if (!g.dragging) return;
    // 基準在跨過門檻之前不動，所以第一次平移把門檻前的那一小段一起補上：
    // 圖與手指維持 1:1，不會一開始就落後 8px。
    dispatch({ type: "PAN", dx: point.x - g.panned.x, dy: point.y - g.panned.y });
    g.panned = point;
  }, [dispatch, viewportRef]);

  const endContact = useCallback((event: PointerEvent<HTMLDivElement>, tappable: boolean) => {
    const el = viewportRef.current;
    const g = session.current;
    if (!el || !g.pointers.has(event.pointerId)) return;
    const origin = g.origin;
    g.pointers.delete(event.pointerId);
    if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);

    // 雙指放開其中一根：剩下那根重新當基準。不重設的話，下一格會拿兩指時期的中點
    // 去算位移，圖會在放手的瞬間跳掉一大段。
    if (g.pointers.size > 0) {
      const [rest] = [...g.pointers.values()];
      g.origin = rest;
      g.panned = rest;
      g.pinch = null;
      g.dragging = true;
      return;
    }

    const wasTap = tappable && !g.dragging && origin !== null;
    g.origin = null;
    g.panned = null;
    g.pinch = null;
    g.dragging = false;
    if (!wasTap || !origin) return;

    // 「兩下，很快，同一個地方」是手指的事實，這裡認得出來。
    // 那兩下**代表**什麼——放大這一區，還是兩段式的確認——是狀態機的事：
    // DOUBLE_TAP 在不該放大的時候會被當成普通的一下處理（見 reduceViewer）。
    const now = performance.now();
    const previous = g.lastContact;
    const isDoubleTap =
      previous !== null &&
      now - previous.at <= DOUBLE_TAP_MS &&
      distance(origin, previous.point) <= DOUBLE_TAP_SLOP_PX;

    if (isDoubleTap) {
      g.lastContact = null;
      dispatch({ type: "DOUBLE_TAP", anchor: origin });
      return;
    }

    g.lastContact = { at: now, point: origin };
    const plan = screenToPlan(latest.current, origin.x, origin.y);
    dispatch({ type: "TAP", x: plan.x, y: plan.y });
  }, [dispatch, viewportRef]);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => endContact(event, true),
    [endContact],
  );

  // 系統把這根手指收走了（來電、系統手勢）。收尾一樣做，但不算點擊——
  // 使用者沒有放開，只是被打斷。
  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => endContact(event, false),
    [endContact],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
