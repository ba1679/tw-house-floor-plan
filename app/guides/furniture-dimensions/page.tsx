import Link from "next/link";
import { TeachingFigure } from "@/components/TeachingFigure";
import { loadFurnitureDimensionsGuide } from "@/lib/guides/data";
import { pageMetadata } from "@/lib/site-metadata";
import styles from "./page.module.css";

export function generateMetadata() {
  const guide = loadFurnitureDimensionsGuide();
  return pageMetadata({
    title: `${guide.title}｜拼厝`,
    description: guide.description,
    path: "/guides/furniture-dimensions",
  });
}

export default function FurnitureDimensionsPage() {
  const guide = loadFurnitureDimensionsGuide();
  const step = guide.steps[0];

  return (
    <main className={styles.page}>
      <article className={styles.column}>
        <Link className={styles.back} href={guide.layoutHref}>回到完整格局</Link>
        <h1 className={styles.title}>{guide.title}</h1>
        <p className={styles.position}>第 1 步・{step.topic}</p>
        <div className={styles.reading}>
          <TeachingFigure figure={step.figure} />
          <div className={styles.observation}>
            <h2 className={styles.observationTitle}>{step.title}</h2>
            {step.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <details className={styles.evidence}>
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
            <Link className={styles.action} href={guide.layoutHref}>回到格局，看看床的位置</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
