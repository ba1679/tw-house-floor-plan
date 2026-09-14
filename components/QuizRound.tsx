"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { FloorPlanViewport, initialViewerConfig } from "./FloorPlanViewport";
import { saveAnswer } from "./progressStorage";
import { useFirstVisitHint } from "./useFirstVisitHint";
import type { RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import {
  createRound,
  isCorrect,
  pendingAnswer,
  questionIndex,
  reduceRound,
  scoreOf,
} from "@/lib/quiz/round";
import type { SymbolRecord } from "@/lib/symbols/types";
import {
  QUIZ_CORRECT,
  QUIZ_NEXT,
  QUIZ_PLAY_AGAIN,
  QUIZ_PROMPT_LEAD,
  QUIZ_WRONG,
  TAP_HINT,
  quizProgress,
  quizScore,
} from "@/lib/ui/copy";
import type { ViewerAction } from "@/lib/viewer/interaction";
import styles from "./Quiz.module.css";

// 一局找找看：題目、圖、作答後的「下一題」、結算。
//
// **狀態機是一局的**（`lib/quiz/round.ts`，docs/adr/0007）：檢視器的 reducer 包在它裡面，
// 圖框（`FloorPlanViewport`）拿到的 dispatch 先經過一局。這個元件只負責把一局的狀態畫出來。
// 不掛 `HighlightFromQuery`：網址帶進來的高亮會把一個符號的每一處同時圈亮，在這裡就是把答案畫在圖上。

type Props = {
  floorplan: FloorPlan;
  symbols: Record<string, SymbolRecord>;
  readingOrder: RoomHotspots[];
  /** 這一局依序要出的 symbol id。 */
  questions: string[];
  onPlayAgain: () => void;
};

export function QuizRound({ floorplan, symbols, readingOrder, questions, onPlayAgain }: Props) {
  // 初始尺寸是占位值，與自由看圖同一份（`initialViewerConfig`）：真正的框掛載後由 RESIZE 量。
  const [round, dispatch] = useReducer(
    reduceRound,
    { viewer: initialViewerConfig(floorplan), questions },
    createRound,
  );

  // 圖框送出來的每一個 action 都先交給一局。同一個函式物件：手勢層的回呼靠它不變才不必每輪重建。
  const dispatchViewer = useCallback(
    (action: ViewerAction) => dispatch({ type: "VIEWER", action }),
    [],
  );

  const next = useCallback(() => dispatch({ type: "NEXT" }), []);

  // 每作答一題立刻寫進學習進度（spec「學習進度」）。一局本身是純的、不碰 localStorage，所以由這裡在作答多一筆時寫。
  // 記到第幾筆存在 ref 裡，不是「寫最後一筆」：開發時 Strict Mode 會重跑 effect，同一筆不能記兩次。
  const saved = useRef(0);
  useEffect(() => {
    for (; saved.current < round.answers.length; saved.current++) {
      saveAnswer(floorplan.id, round.answers[saved.current]);
    }
  }, [round.answers, floorplan.id]);

  // 首次引導與平面圖頁共用同一句、同一個記錄（spec「首次引導」）：在哪一頁先看到都算看過。
  const hint = useFirstVisitHint();

  if (round.phase === "finished") {
    return (
      <section className={styles.screen}>
        <p className={styles.score}>{quizScore(scoreOf(round), questions.length)}</p>
        <button type="button" className={styles.primary} onClick={onPlayAgain}>
          {QUIZ_PLAY_AGAIN}
        </button>
      </section>
    );
  }

  const index = questionIndex(round);
  const target = questions[index];
  const answer = pendingAnswer(round);

  // 作答之後說對或錯；出題中只有第一題說引導——那句話教的是怎麼點，第二題的時候他已經點過一次了。
  const restingStatus = answer
    ? isCorrect(answer)
      ? QUIZ_CORRECT
      : QUIZ_WRONG
    : index === 0 && hint.visible
      ? TAP_HINT
      : "";

  return (
    <>
      <div id="quiz-question" className={styles.question}>
        <p id="quiz-progress" className={styles.progress}>
          {quizProgress(index + 1, questions.length)}
        </p>
        <p className={styles.prompt}>
          {QUIZ_PROMPT_LEAD}
          <strong id="quiz-question-name" className={styles.target}>
            {symbols[target]?.name}
          </strong>
        </p>
      </div>

      <FloorPlanViewport
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder}
        viewer={round.viewer}
        dispatch={dispatchViewer}
        dimRooms={false}
        restingStatus={restingStatus}
        hint={hint}
      />

      {answer && (
        <div className={styles.next}>
          <button type="button" className={styles.primary} onClick={next}>
            {QUIZ_NEXT}
          </button>
        </div>
      )}
    </>
  );
}
