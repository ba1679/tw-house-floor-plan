"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { FloorPlanViewport, initialViewerConfig } from "./FloorPlanViewport";
import { InfoSheet, type SheetNote } from "./InfoSheet";
import { KnownCount } from "./KnownCount";
import { LabelledList } from "./LabelledList";
import { useEscapeKey } from "./useEscapeKey";
import { useFirstVisitHint } from "./useFirstVisitHint";
import { useSaveAnswers } from "./useLearningProgress";
import { recordSymbolView } from "@/lib/analytics/gtag";
import type { RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import type { LayoutProgress } from "@/lib/quiz/progress";
import {
  createRound,
  isCorrect,
  pendingAnswer,
  questionIndex,
  reduceRound,
  scoreOf,
  type Answer,
} from "@/lib/quiz/round";
import { symbolName } from "@/lib/symbols/name";
import type { SymbolRecord } from "@/lib/symbols/types";
import {
  QUIZ_BACK_TO_PLAN,
  QUIZ_CORRECT,
  QUIZ_NEXT,
  QUIZ_PLAY_AGAIN,
  QUIZ_PROMPT_LEAD,
  QUIZ_REVIEW_HEADING,
  QUIZ_SHOW_SHEET,
  QUIZ_WRONG,
  TAP_HINT,
  quizPicked,
  quizProgress,
  quizReviewRow,
  quizScore,
} from "@/lib/ui/copy";
import { occurrencesOf, type ViewerAction } from "@/lib/viewer/interaction";
import styles from "./Quiz.module.css";

// 一局找找看：題目、圖、作答後的回饋與說明卡、結算。
//
// **狀態機是一局的**（`lib/quiz/round.ts`，docs/adr/0007）：檢視器的 reducer 包在它裡面，
// 圖框（`FloorPlanViewport`）拿到的 dispatch 先經過一局。作答後的暫停、說明卡開沒開、圖上的標記都由一局決定，
// 這個元件把它們畫出來，並替鍵盤使用者搬焦點。學習進度的寫入交給 `useSaveAnswers`。
// 不掛 `HighlightFromQuery`：網址帶進來的高亮會把一個符號的每一處同時圈亮，在這裡就是把答案畫在圖上。

type Props = {
  floorplan: FloorPlan;
  symbols: Record<string, SymbolRecord>;
  readingOrder: RoomHotspots[];
  /** 這張圖的可出題符號：結算「你認得 N / M」的分母，分子也只數它們（M4 票 05）。 */
  quizzable: string[];
  /** 這一局依序要出的 symbol id。 */
  questions: string[];
  /** 這一局開始時的紀錄（出題讀到的那一份）：結算的刻度拿它標出這一局新認得的格子（M4 票 11）。 */
  progressAtStart: LayoutProgress;
  onPlayAgain: () => void;
};

/**
 * 答錯時說明卡最上面那一段：「你點的是 X」；X 正好在題目的 `confused_with` 裡時，接上那一筆的差異句（spec「作答之後」）。
 *
 * **只查題目那一側**：卡片講的是題目符號，差異句要從它的角度說。查不到就只有那一句——
 * 圖上最常點錯的柱與相鄰的窗是位置相鄰、不是畫法相似，沒有差異句是對的，不是缺資料（PRD §6.3.3）。
 */
function pickedNote(answer: Answer, symbols: Record<string, SymbolRecord>): SheetNote {
  const difference = symbols[answer.target]?.confused_with.find(
    (other) => other.symbol_id === answer.picked,
  )?.difference;
  return {
    lead: quizPicked(symbolName(symbols, answer.picked)),
    detail: difference ?? null,
  };
}

export function QuizRound({
  floorplan,
  symbols,
  readingOrder,
  quizzable,
  questions,
  progressAtStart,
  onPlayAgain,
}: Props) {
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

  // 每作答一題立刻寫進學習進度（spec「學習進度」）。回傳的是寫完之後讀回來的那一份：結算的「你認得」要算進這一局。
  const stored = useSaveAnswers(floorplan.id, round.answers);

  /**
   * 鍵盤焦點要不要跟著一局走（票 01 留下的：作答後「下一題」排在所有熱區之後，要 Tab 很多下才到）。
   *
   * 用鍵盤在熱區上作答、或按了「看說明」的人，焦點跟著走：答錯時進說明卡、卡片關了落在「下一題」、
   * 按下「下一題」落在新的題目上。用手指點圖的人不搬，理由同自由看圖（`FloorPlanViewer` 的 `keyboardOrigin`）：
   * 替他把焦點搬來搬去，只會讓讀螢幕的游標莫名其妙地跳。
   *
   * 「看說明」算在內，是因為那顆按鈕按下去就消失了：不把焦點收進卡片，焦點就掉回頁面的最開頭。
   */
  const [focusFollows, setFocusFollows] = useState(false);
  const onTouch = useCallback(() => setFocusFollows(false), []);
  const onKeyboardSelect = useCallback(() => setFocusFollows(true), []);

  const next = useCallback(() => dispatch({ type: "NEXT" }), []);
  const openSheet = useCallback(() => {
    setFocusFollows(true);
    dispatch({ type: "OPEN_SHEET" });
  }, []);
  // 關卡片**不派 RESELECT**——那是自由看圖的關法。找找看關了卡片，標記留著、圖照樣暫停（spec）。
  const closeSheet = useCallback(() => dispatch({ type: "CLOSE_SHEET" }), []);

  // Esc 關掉說明卡，與關閉鍵同一個 action。卡片沒開時 Esc 什麼都不做。
  useEscapeKey(round.sheetOpen, closeSheet);

  const questionRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  // 說明卡開著時焦點由卡片自己收（`takeFocus`），其餘的去處在這裡。
  // 最後一題的「下一題」按下去就不在了（M4 票 05）：焦點接在成績上，不然掉回頁面最開頭，讀螢幕的人聽不到這一局的結果。
  useEffect(() => {
    if (!focusFollows) return;
    if (round.phase === "answered" && !round.sheetOpen) nextRef.current?.focus();
    if (round.phase === "question" && round.answers.length > 0) questionRef.current?.focus();
    if (round.phase === "finished") scoreRef.current?.focus();
  }, [focusFollows, round.phase, round.sheetOpen, round.answers.length]);

  // 首次引導與平面圖頁共用同一句、同一個記錄（spec「首次引導」）：在哪一頁先看到都算看過。
  const hint = useFirstVisitHint();
  const answer = pendingAnswer(round);

  useEffect(() => {
    if (!answer || !round.sheetOpen) return;
    recordSymbolView({
      symbol_id: answer.target,
      source: "quiz",
      layout_id: floorplan.id,
      hotspot_id: answer.hotspotId,
    });
  }, [answer, floorplan.id, round.sheetOpen]);

  if (round.phase === "finished") {
    // 答錯清單只從這一局的作答來：「你答成了 X」只在記憶體裡，不進 localStorage（M4 票 05；票 04 的紀錄格式不變）。
    // 一局裡題目不重複，所以一個題目符號最多一列。全部答對時整份不印——不誇獎，也就不需要一句「沒有答錯」。
    const missed = round.answers.filter((a) => !isCorrect(a));

    return (
      <section className={styles.screen}>
        {/* tabIndex -1：用鍵盤按下最後一題「下一題」之後焦點的落點。不進 Tab 序列。 */}
        <p ref={scoreRef} tabIndex={-1} className={styles.score}>
          {quizScore(scoreOf(round), questions.length)}
        </p>

        {/* 每一列連到**題目**的符號頁，不是被點中的那一個：要再讀一次的是他沒認出來的東西（PRD §6.3.3）。 */}
        <LabelledList id="quiz-review" heading={QUIZ_REVIEW_HEADING} className={styles.review}>
          {missed.map((a) => (
            <li key={a.target}>
              <Link href={`/symbols/${a.target}`} className={styles.reviewLink}>
                {quizReviewRow(symbolName(symbols, a.target), symbolName(symbols, a.picked))}
              </Link>
            </li>
          ))}
        </LabelledList>

        {/* 這一局寫完之後讀回來的那一份（`useSaveAnswers`），所以已經是這一局之後的數字。
            localStorage 被封鎖時讀回來的是空紀錄，印的就是 0：這一局沒有被記住，「再玩一次」出題讀到的也是那份空紀錄。
            為什麼是 0，`KnownCount` 在數字底下說。
            交進開始時的那一份，刻度就把這一局新認得的格子加高（M4 票 11）。 */}
        {stored && (
          <KnownCount
            layoutName={floorplan.name}
            quizzable={quizzable}
            stored={stored}
            progressAtStart={progressAtStart}
          />
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onPlayAgain}>
            {QUIZ_PLAY_AGAIN}
          </button>
          <Link href={`/layouts/${floorplan.id}`} className={styles.secondaryLink}>
            {QUIZ_BACK_TO_PLAN}
          </Link>
        </div>
      </section>
    );
  }

  const index = questionIndex(round);
  const target = questions[index];
  // 說明卡講的是**題目符號**，不是被點中的那一個（spec）：答錯時兩者不同。
  const sheetSymbol = answer && round.sheetOpen ? symbols[answer.target] : undefined;

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
      {/* tabIndex -1：按下「下一題」之後鍵盤焦點的落點，讀螢幕的人接著聽到的就是新的題目。不進 Tab 序列。 */}
      <div id="quiz-question" ref={questionRef} tabIndex={-1} className={styles.question}>
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
        // 標記由一局交給框（docs/adr/0007）：作答之後才有，出題中兩個都是 null——
        // 作答之前，題目的答案不是任何一種 State（CONTEXT.md）。
        selectedHotspot={answer?.hotspotId ?? null}
        correctHotspot={answer && isCorrect(answer) ? answer.hotspotId : null}
        revealedSymbol={answer?.target ?? null}
        // 熱區只有圖上標出來的那幾個念名字：作答之前一個都沒有，作答之後只放開這一題的（spec「作答之前不露名字」）。
        names="marked"
        paused={round.phase === "answered"}
        dimRooms={round.sheetOpen}
        restingStatus={restingStatus}
        hint={hint}
        onTouch={onTouch}
        onKeyboardSelect={onKeyboardSelect}
      />

      {/* 「下一題」排在前面、位置固定：「看說明」在卡片開著時不出現，排在前面的話「下一題」會跟著左右跳。 */}
      {answer && (
        <div className={styles.next}>
          <button ref={nextRef} type="button" className={styles.primary} onClick={next}>
            {QUIZ_NEXT}
          </button>
          {!round.sheetOpen && (
            <button type="button" className={styles.secondary} onClick={openSheet}>
              {QUIZ_SHOW_SHEET}
            </button>
          )}
        </div>
      )}

      {answer && sheetSymbol && (
        <InfoSheet
          symbol={sheetSymbol}
          symbols={symbols}
          // 只有「共 N 處」：每一處已經都標在圖上。N 與自由看圖的卡片同一個算法。
          occurrence={{ total: occurrencesOf(round.viewer, answer.target).length }}
          note={isCorrect(answer) ? undefined : pickedNote(answer, symbols)}
          takeFocus={focusFollows}
          onClose={closeSheet}
        />
      )}
    </>
  );
}
