import { groupByFamiliarity, type LayoutProgress } from "@/lib/quiz/progress";
import { knownCountLabel } from "@/lib/ui/copy";
import styles from "./Quiz.module.css";

// 「這張三房兩廳你認得 N / M」與底下的刻度（PRD §6.6「進度條」）。找找看的開場與結算各印一次（M4 票 05）。
//
// 沒有獨立的進度頁（PRD §11 #28），同一個數字只住在這兩個畫面上，所以兩處是同一個元件——各寫一份，遲早長成兩個樣子。
// **分子與分母也在這裡算**，不交給兩個呼叫端各算一次：分母是可出題符號數，分子只數其中已認識的（`groupByFamiliarity`），
// 所以紀錄裡不是可出題符號的 id 灌不大它。
// **不自己讀進度**：讀哪一份由呼叫端決定（開場讀掛上那一刻的，結算讀這一局寫完之後的），還沒讀到時也由呼叫端不掛它。

type Props = {
  layoutName: string;
  /** 這張圖的可出題符號（`quizzableSymbols`）：分母，也是分子只數的範圍。 */
  quizzable: string[];
  /** 這張圖的學習進度。 */
  progress: LayoutProgress;
};

export function KnownCount({ layoutName, quizzable, progress }: Props) {
  const known = groupByFamiliarity(quizzable, progress).known.length;
  const total = quizzable.length;
  return (
    <div className={styles.known}>
      <p className={styles.knownCount}>{knownCountLabel(layoutName, known, total)}</p>
      {/* 刻度而不是百分比條：一格一個符號，使用者數得出還差幾個。字已經說了數字，刻度對讀螢幕的人是重複的，所以藏起來。 */}
      <div className={styles.meter} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < known ? styles.filled : undefined} />
        ))}
      </div>
    </div>
  );
}
