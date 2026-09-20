"use client";

import { useCallback, useState } from "react";
import { KnownCount } from "./KnownCount";
import { LabelledList } from "./LabelledList";
import { QuizRound } from "./QuizRound";
import { loadLayoutProgress, useLayoutProgress } from "./useLearningProgress";
import type { RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import { groupByFamiliarity, wrongCount, type LayoutProgress } from "@/lib/quiz/progress";
import { pickQuestions, roundSize } from "@/lib/quiz/questions";
import { symbolName } from "@/lib/symbols/name";
import type { SymbolRecord } from "@/lib/symbols/types";
import {
  FAMILIARITY_LABELS,
  KNOWN_DEFINITION,
  QUIZ_START,
  quizIntro,
  wrongTimesLabel,
} from "@/lib/ui/copy";
import styles from "./Quiz.module.css";

// 找找看頁的 client 那一半：開場 → 一局 → （結算在一局裡）。
//
// 一局的進行狀態**只在記憶體裡**（spec「一局的流程」）：重新整理、離開再回來，都回到開場、重新出題。
// 開場同時是學習進度住的地方（PRD §6.6）：沒有獨立的進度頁，想知道自己還差什麼的那一刻，正是要開始玩的那一刻。

type Props = {
  floorplan: FloorPlan;
  symbols: Record<string, SymbolRecord>;
  readingOrder: RoomHotspots[];
  /** 這張圖的可出題符號（`quizzableSymbols`，在 build 時算好）。 */
  quizzable: string[];
};

export function QuizGame({ floorplan, symbols, readingOrder, quizzable }: Props) {
  /**
   * 正在玩的那一局。`key` 每開一局加一：「再玩一次」換一個 key，`QuizRound` 就是一個全新掛上的元件——
   * 狀態機、首次引導、卡片的展開與否，一律從頭來，不必逐欄重設。
   * `progressAtStart` 是這一局開始時的紀錄：結算的刻度拿它與寫完之後的那一份比，標出這一局新認得的（M4 票 11）。
   */
  const [round, setRound] = useState<{
    key: number;
    questions: string[];
    progressAtStart: LayoutProgress;
  } | null>(null);

  // 出題只能在瀏覽器裡、按下去的那一刻做：題目依 localStorage 裡的進度排優先序，再用 `Math.random` 挑——
  // 在伺服器上先出好，靜態 HTML 裡的題目每個人都一樣。「再玩一次」也走這裡，所以讀到的是剛打完那一局之後的進度，
  // 不是下面開場掛上時讀的那一份。
  //
  // 出題讀到的這一份，就是結算刻度的「這一局開始時」（M4 票 11）：同一個理由，第二局的開始時是第一局結束之後。
  const start = useCallback(() => {
    const progressAtStart = loadLayoutProgress(floorplan.id);
    const questions = pickQuestions(quizzable, progressAtStart, Math.random);
    setRound((current) => ({ key: (current?.key ?? 0) + 1, questions, progressAtStart }));
  }, [quizzable, floorplan.id]);

  /**
   * 開場印的進度（M4 票 05）：client 接手、讀到 localStorage 之後才有。在那之前分子與清單都不印——
   * 靜態 HTML 先印一個「0 / 13」再跳成真的數字，那一瞬間的 0 就是進度條在說謊。
   *
   * 「開始」也等它。靜態 HTML 裡的按鈕按了沒有反應——那一瞬間的死按鈕，使用者會以為網站壞了，或多按幾下。
   * 讀到進度就表示 client 已經接手，兩件事是同一刻，所以不另外記一個「接手了沒」。
   * 也因此數字與刻度出現在上面、把按鈕往下推的那一刻，按鈕才剛變得按得下去：不會有人按到一半被推走（清單排在按鈕下面，推不動它，M4 票 10）。
   */
  const stored = useLayoutProgress(floorplan.id);

  if (round) {
    return (
      <QuizRound
        key={round.key}
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder}
        quizzable={quizzable}
        questions={round.questions}
        progressAtStart={round.progressAtStart}
        onPlayAgain={start}
      />
    );
  }

  // 清單的分組與出題是同一個算法（`groupByFamiliarity`），還不熟那一組也是同一個排法：錯最多的在前。
  // 組與組的先後刻意不同：出題先考還沒遇到的（打完兩局才考得遍），開場先列還不熟的（使用者來這裡是想知道還差什麼）。
  const groups = stored && groupByFamiliarity(quizzable, stored.progress);
  const nameOf = (id: string) => symbolName(symbols, id);

  return (
    <section className={styles.screen}>
      {stored && (
        <>
          <KnownCount layoutName={floorplan.name} quizzable={quizzable} stored={stored} />
          <p className={styles.definition}>{KNOWN_DEFINITION}</p>
        </>
      )}

      <p className={styles.lead}>{quizIntro(roundSize(quizzable.length))}</p>
      {/* 全部認得之後照樣按得下去（PRD §6.6）：出題就在已認識的那一組裡隨機。 */}
      <button type="button" className={styles.start} onClick={start} disabled={!stored}>
        {QUIZ_START}
      </button>

      {/* 清單排在「開始」下面（M4 票 10）：來這裡的人多半是要玩，清單是想看的人往下讀的參考。
          排在上面的話，還不熟一列一個，錯過的符號一多，按鈕就被推出第一屏。 */}
      {stored && groups && (
        <>
          {/* 還不熟排最前面、錯最多的在前：使用者來這裡是想知道還差什麼（PRD §6.6.1）。 */}
          <LabelledList id="quiz-missed" heading={FAMILIARITY_LABELS.missed} className={styles.missed}>
            {groups.missed.map((id) => (
              <li key={id}>
                <span>{nameOf(id)}</span>{" "}
                <span className={styles.wrongCount}>{wrongTimesLabel(wrongCount(stored.progress, id))}</span>
              </li>
            ))}
          </LabelledList>
          <LabelledList id="quiz-unseen" heading={FAMILIARITY_LABELS.unseen} className={styles.names}>
            {groups.unseen.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </LabelledList>
          <LabelledList id="quiz-known" heading={FAMILIARITY_LABELS.known} className={styles.names}>
            {groups.known.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </LabelledList>
        </>
      )}
    </section>
  );
}
