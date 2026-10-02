import type { MouseEventHandler } from "react";
import { FLOORPLAN_GUIDE } from "@/lib/ui/copy";
import styles from "./FloorPlanGuide.module.css";

/** 操作提示只呈現下一步；試點的熱區與 action 由自由看圖的 owner 決定。 */
export function FloorPlanGuide({
  confirming,
  action,
}: {
  confirming: boolean;
  action?: { label: string; onClick: MouseEventHandler<HTMLButtonElement> };
}) {
  return (
    <section className={styles.guide} aria-label={FLOORPLAN_GUIDE.label}>
      <p className={styles.title}>
        <span className={styles.legend} aria-hidden="true" />
        {confirming ? FLOORPLAN_GUIDE.confirmTitle : FLOORPLAN_GUIDE.browseTitle}
      </p>
      <ol className={styles.steps}>
        <li aria-current={!confirming ? "step" : undefined}>
          <span className={styles.number} aria-hidden="true">
            {confirming ? (
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none">
                <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" />
              </svg>
            ) : "1"}
          </span>
          {FLOORPLAN_GUIDE.locate}
        </li>
        <li aria-current={confirming ? "step" : undefined}>
          <span className={styles.number} aria-hidden="true">2</span>
          {FLOORPLAN_GUIDE.confirm}
        </li>
      </ol>
      {action && (
        <button type="button" className={styles.actionButton} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
}
