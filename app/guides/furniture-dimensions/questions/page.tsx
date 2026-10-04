import Link from "next/link";
import { GuideQuestionList } from "@/components/GuideQuestionList";
import { PrintChecklistButton } from "@/components/PrintChecklistButton";
import { loadFurnitureDimensionsChecklist } from "@/lib/guides/data";
import { pageMetadata } from "@/lib/site-metadata";
import styles from "./page.module.css";

const GUIDE_HREF = "/guides/furniture-dimensions";

export function generateMetadata() {
  const checklist = loadFurnitureDimensionsChecklist();
  return pageMetadata({
    title: `${checklist.title}｜拼厝`,
    description: checklist.scope,
    path: `${GUIDE_HREF}/questions`,
  });
}

export default function FurnitureQuestionsPage() {
  const checklist = loadFurnitureDimensionsChecklist();
  return (
    <main className={styles.page} data-print-checklist>
      <article className={styles.column}>
        <nav className={styles.actions} aria-label="清單操作">
          <Link href={GUIDE_HREF}>返回導讀</Link>
          <PrintChecklistButton className={styles.printButton} />
        </nav>
        <h1 className={styles.title}>{checklist.title}</h1>
        <p className={styles.scope}>{checklist.scope}</p>
        <GuideQuestionList questions={checklist.questions} label="向建商追問" />
      </article>
    </main>
  );
}
