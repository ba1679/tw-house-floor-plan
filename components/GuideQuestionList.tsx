import type { GuideQuestion } from "@/lib/guides/data";
import styles from "./GuideQuestionList.module.css";

export function GuideQuestionList({ questions, label }: { questions: GuideQuestion[]; label: string }) {
  return (
    <ol className={styles.questions} aria-label={label}>
      {questions.map((item) => (
        <li key={item.id} className={styles.question}>
          <p className={styles.ask}>{item.question}</p>
          <p className={styles.reason}><strong>為什麼問：</strong>{item.reason}</p>
        </li>
      ))}
    </ol>
  );
}
