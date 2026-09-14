"use client";

import { useCallback, useEffect, useState } from "react";
import { QuizRound } from "./QuizRound";
import type { RoomHotspots } from "@/lib/floorplan/reading-order";
import type { FloorPlan } from "@/lib/floorplan/types";
import { pickQuestions, roundSize } from "@/lib/quiz/questions";
import type { SymbolRecord } from "@/lib/symbols/types";
import { QUIZ_START, quizIntro } from "@/lib/ui/copy";
import styles from "./Quiz.module.css";

// 找找看頁的 client 那一半：開場 → 一局 → （結算在一局裡）。
//
// 一局的進行狀態**只在記憶體裡**（spec「一局的流程」）：重新整理、離開再回來，都回到開場、重新出題。

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
   */
  const [round, setRound] = useState<{ key: number; questions: string[] } | null>(null);

  // 出題用 `Math.random`，只能在瀏覽器裡、按下去的那一刻做：在伺服器上先出好，靜態 HTML 裡的題目每個人都一樣。
  const start = useCallback(() => {
    const questions = pickQuestions(quizzable, Math.random);
    setRound((current) => ({ key: (current?.key ?? 0) + 1, questions }));
  }, [quizzable]);

  /**
   * 「開始」在 client 接手之前是停用的。靜態 HTML 裡的按鈕按了沒有反應——那一瞬間的死按鈕，
   * 使用者會以為網站壞了，或多按幾下。
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (round) {
    return (
      <QuizRound
        key={round.key}
        floorplan={floorplan}
        symbols={symbols}
        readingOrder={readingOrder}
        questions={round.questions}
        onPlayAgain={start}
      />
    );
  }

  return (
    <section className={styles.screen}>
      <p className={styles.lead}>{quizIntro(roundSize(quizzable.length))}</p>
      <button type="button" className={styles.primary} onClick={start} disabled={!hydrated}>
        {QUIZ_START}
      </button>
    </section>
  );
}
