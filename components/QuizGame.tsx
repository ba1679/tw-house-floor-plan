"use client";

import { useCallback, useState, type ReactElement } from "react";
import { KnownCount } from "./KnownCount";
import { QuizRound } from "./QuizRound";
import { loadLayoutProgress, useLayoutProgress } from "./useLearningProgress";
import type { RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import { familiarityTiers, wrongCount } from "@/lib/quiz/progress";
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

/** 開場的一份熟悉度清單：標題加清單，清單以標題命名。這一層一個符號都沒有時整份不印——只有標題的空清單是雜訊。 */
function TierList({ id, label, className, children }: {
  id: string;
  label: string;
  className: string;
  children: ReactElement[];
}) {
  if (children.length === 0) return null;
  const headingId = `${id}-heading`;
  return (
    <>
      <h2 id={headingId} className={styles.listHeading}>
        {label}
      </h2>
      <ul aria-labelledby={headingId} className={className}>
        {children}
      </ul>
    </>
  );
}

export function QuizGame({ floorplan, symbols, readingOrder, quizzable }: Props) {
  /**
   * 正在玩的那一局。`key` 每開一局加一：「再玩一次」換一個 key，`QuizRound` 就是一個全新掛上的元件——
   * 狀態機、首次引導、卡片的展開與否，一律從頭來，不必逐欄重設。
   */
  const [round, setRound] = useState<{ key: number; questions: string[] } | null>(null);

  // 出題只能在瀏覽器裡、按下去的那一刻做：題目依 localStorage 裡的進度排優先序，再用 `Math.random` 挑——
  // 在伺服器上先出好，靜態 HTML 裡的題目每個人都一樣。「再玩一次」也走這裡，所以讀到的是剛打完那一局之後的進度，
  // 不是下面開場掛上時讀的那一份。
  const start = useCallback(() => {
    const questions = pickQuestions(quizzable, loadLayoutProgress(floorplan.id), Math.random);
    setRound((current) => ({ key: (current?.key ?? 0) + 1, questions }));
  }, [quizzable, floorplan.id]);

  /**
   * 開場印的進度（M4 票 05）：client 接手、讀到 localStorage 之後才有。在那之前分子與清單都不印——
   * 靜態 HTML 先印一個「0 / 13」再跳成真的數字，那一瞬間的 0 就是進度條在說謊。
   *
   * 「開始」也等它。靜態 HTML 裡的按鈕按了沒有反應——那一瞬間的死按鈕，使用者會以為網站壞了，或多按幾下。
   * 讀到進度就表示 client 已經接手，兩件事是同一刻，所以不另外記一個「接手了沒」。
   * 也因此清單出現、把按鈕往下推的那一刻，按鈕才剛變得按得下去：不會有人按到一半被推走。
   */
  const progress = useLayoutProgress(floorplan.id);

  if (round) {
    return (
      <QuizRound
        key={round.key}
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder}
        quizzable={quizzable}
        questions={round.questions}
        onPlayAgain={start}
      />
    );
  }

  // 分層與出題是同一個算法（`familiarityTiers`）：開場說你最該練的，就是出題最先考的。
  const tiers = progress && familiarityTiers(quizzable, progress);
  const nameOf = (id: string) => symbolName(symbols, id);

  return (
    <section className={styles.screen}>
      {progress && tiers && (
        <>
          <KnownCount layoutName={floorplan.name} known={tiers.known.length} total={quizzable.length} />
          <p className={styles.definition}>{KNOWN_DEFINITION}</p>

          {/* 還不熟排最前面、錯最多的在前：使用者來這裡是想知道還差什麼（PRD §6.6.1）。 */}
          <TierList id="quiz-missed" label={FAMILIARITY_LABELS.missed} className={styles.missed}>
            {tiers.missed.map((id) => (
              <li key={id}>
                <span>{nameOf(id)}</span>{" "}
                <span className={styles.wrongCount}>{wrongTimesLabel(wrongCount(progress, id))}</span>
              </li>
            ))}
          </TierList>
          <TierList id="quiz-unseen" label={FAMILIARITY_LABELS.unseen} className={styles.names}>
            {tiers.unseen.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </TierList>
          <TierList id="quiz-known" label={FAMILIARITY_LABELS.known} className={styles.names}>
            {tiers.known.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </TierList>
        </>
      )}

      <p className={styles.lead}>{quizIntro(roundSize(quizzable.length))}</p>
      {/* 全部認得之後照樣按得下去（PRD §6.6）：出題就在已認識的層裡隨機。 */}
      <button type="button" className={styles.primary} onClick={start} disabled={!progress}>
        {QUIZ_START}
      </button>
    </section>
  );
}
