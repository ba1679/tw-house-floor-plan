"use client";

import Link from "next/link";
import { useState } from "react";
import type { InterpretationPracticeContent } from "@/lib/guides/data";
import { TeachingFigure } from "./TeachingFigure";
import styles from "./InterpretationPractice.module.css";

export function InterpretationPractice({ practice }: { practice: InterpretationPracticeContent }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { question } = practice;
  const chosen = question.options.find((option) => option.id === selected);
  const correct = question.options.find((option) => option.id === question.correctOptionId)!;
  const isCorrect = chosen?.id === correct.id;

  function retry() {
    setSelected(null);
    setConfirmed(false);
  }

  return (
    <main className={styles.page}>
      <article className={styles.column}>
        <Link className={styles.back} href="/guides/furniture-dimensions">回看家具與尺寸導讀</Link>
        <h1 className={styles.title}>{practice.title}</h1>
        <p className={styles.position}>第 1 題・有依據的結論</p>
        <div className={styles.reading}>
          <div>
            <TeachingFigure figure={practice.figure} />
            <div className={styles.conditions}>
              <h2>本圖明列條件</h2>
              <ul>{practice.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
            </div>
          </div>
          <div className={styles.question}>
            <fieldset disabled={confirmed}>
              <legend>{question.prompt}</legend>
              <div className={styles.options}>
                {question.options.map((option) => (
                  <label key={option.id} className={styles.option}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option.id}
                      checked={selected === option.id}
                      onChange={() => setSelected(option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {!confirmed && (
              <button className={styles.confirm} type="button" disabled={!selected} onClick={() => setConfirmed(true)}>
                確認答案
              </button>
            )}
            {confirmed && chosen && (
              <>
                <div className={styles.feedback} data-result={isCorrect ? "correct" : "incorrect"} role="status">
                  <h2><span aria-hidden="true">{isCorrect ? "✓" : "×"}</span> {isCorrect ? "答對" : "答錯"}</h2>
                  <p>{chosen.reason}</p>
                  {!isCorrect && <p>有依據的結論是：{correct.label} {correct.reason}</p>}
                </div>
                <button className={styles.retry} type="button" onClick={retry}>重試這一題</button>
              </>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
