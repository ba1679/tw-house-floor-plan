"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GuideStep } from "@/lib/guides/data";
import { TeachingFigure } from "./TeachingFigure";
import styles from "./GuideReader.module.css";

type Guide = { title: string; layoutHref: string; steps: GuideStep[] };

export function GuideReader({ guide }: { guide: Guide }) {
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const step = guide.steps[index];

  useEffect(() => {
    if (navigated.current) heading.current?.focus();
  }, [index]);

  function showStep(next: number) {
    navigated.current = true;
    setIndex(next);
  }

  return (
    <main className={styles.page}>
      <article className={styles.column}>
        <Link className={styles.back} href={guide.layoutHref}>回到完整格局</Link>
        <h1 className={styles.title}>{guide.title}</h1>
        <p className={styles.position}>第 {index + 1} 步，共 {guide.steps.length} 步・{step.topic}</p>
        <div className={styles.reading}>
          <TeachingFigure figure={step.figure} />
          <div className={styles.observation}>
            <h2 ref={heading} tabIndex={-1} className={styles.observationTitle}>{step.title}</h2>
            {step.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <details key={step.id} className={styles.evidence}>
              <summary>看這一步的依據</summary>
              {step.evidence.map((evidence) => (
                <div key={evidence.id}>
                  <h3>{evidence.label}</h3>
                  <p>{evidence.explanation}</p>
                  <ul>{evidence.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
                </div>
              ))}
              <Link className={styles.sourceLink} href={guide.layoutHref}>核對完整教學範例</Link>
            </details>
            <nav className={styles.stepNav} aria-label="導讀步驟">
              {index > 0 && <button type="button" onClick={() => showStep(index - 1)}>上一步：{guide.steps[index - 1].topic}</button>}
              {index < guide.steps.length - 1 && <button type="button" onClick={() => showStep(index + 1)}>下一步：{guide.steps[index + 1].topic}</button>}
            </nav>
            <Link className={styles.action} href={guide.layoutHref}>{step.layoutActionLabel}</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
