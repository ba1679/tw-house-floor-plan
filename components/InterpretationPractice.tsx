"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { InterpretationPracticeContent } from "@/lib/guides/data";
import { TeachingFigure } from "./TeachingFigure";
import styles from "./InterpretationPractice.module.css";

export function InterpretationPractice({ practice }: { practice: InterpretationPracticeContent }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [complete, setComplete] = useState(false);
  const questionHeading = useRef<HTMLLegendElement>(null);
  const completionHeading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const question = practice.questions[questionIndex];
  const nextQuestion = practice.questions[questionIndex + 1];
  const chosen = question.options.find((option) => option.id === selected);
  const correct = question.options.find((option) => option.id === question.correctOptionId)!;
  const isCorrect = chosen?.id === correct.id;

  useEffect(() => {
    if (!navigated.current) return;
    if (complete) completionHeading.current?.focus();
    else questionHeading.current?.focus();
  }, [complete, questionIndex]);

  function retry() {
    setSelected(null);
    setConfirmed(false);
  }

  function advance() {
    navigated.current = true;
    retry();
    if (nextQuestion) setQuestionIndex((index) => index + 1);
    else setComplete(true);
  }

  function restart() {
    navigated.current = true;
    setQuestionIndex(0);
    setComplete(false);
    retry();
  }

  return (
    <main className={styles.page}>
      <article className={styles.column}>
        <Link className={styles.back} href="/guides/furniture-dimensions">回看家具與尺寸導讀</Link>
        <h1 className={styles.title}>{practice.title}</h1>
        {complete ? (
          <section className={styles.completion} aria-labelledby="practice-complete-title">
            <h2 id="practice-complete-title" ref={completionHeading} tabIndex={-1}>三題練習完成</h2>
            <p>你已依同一張圖練習分辨有依據的結論、尚缺的資訊，以及能補足缺口的追問。</p>
            <p>需要時可以重新練習或回看導讀；提問清單不需要答對或完成練習也能直接使用。</p>
            <div className={styles.completionActions}>
              <Link className={styles.primaryLink} href="/guides/furniture-dimensions/questions">取得可列印提問清單</Link>
              <button className={styles.retry} type="button" onClick={restart}>重新練習三題</button>
            </div>
          </section>
        ) : (
          <>
            <p className={styles.position}>第 {questionIndex + 1} 題，共 {practice.questions.length} 題・{question.topic}</p>
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
                  <legend ref={questionHeading} tabIndex={-1}>{question.prompt}</legend>
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
                      {!isCorrect && <p>有依據的答案是：{correct.label} {correct.reason}</p>}
                    </div>
                    <div className={styles.answerActions}>
                      <button className={styles.retry} type="button" onClick={retry}>重試這一題</button>
                      <button className={styles.next} type="button" onClick={advance}>
                        {nextQuestion ? `下一題：${nextQuestion.topic}` : "完成練習"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </article>
    </main>
  );
}
