import type { StoredProgress } from "./useLearningProgress";
import { groupByFamiliarity, type LayoutProgress } from "@/lib/quiz/progress";
import { STORAGE_BLOCKED_NOTE, freshKnownNote, knownCountLabel } from "@/lib/ui/copy";
import styles from "./Quiz.module.css";

// 「這張三房兩廳你認得 N / M」與底下的刻度（PRD §6.6「進度條」）。找找看的開場與結算各印一次（M4 票 05）。
//
// 沒有獨立的進度頁（PRD §11 #28），同一個數字只住在這兩個畫面上，所以兩處是同一個元件——各寫一份，遲早長成兩個樣子。
// **分子與分母也在這裡算**，不交給兩個呼叫端各算一次：分母是可出題符號數，分子只數其中已認識的（`groupByFamiliarity`），
// 所以紀錄裡不是可出題符號的 id 灌不大它。
// **不自己讀進度**：讀哪一份由呼叫端決定（開場讀掛上那一刻的，結算讀這一局寫完之後的），還沒讀到時也由呼叫端不掛它。
// 結算另外交進這一局開始時的那一份，刻度拿兩份比出這一局新認得的（M4 票 11）。

type Props = {
  layoutName: string;
  /** 這張圖的可出題符號（`quizzableSymbols`）：分母，也是分子只數的範圍。 */
  quizzable: string[];
  /** 這張圖的學習進度，以及這台瀏覽器記不記得住（`useLayoutProgress`、`useSaveAnswers`）。 */
  stored: StoredProgress;
  /** 這一局開始時的紀錄。**只有結算給**：給了，刻度把這一局新認得的格子加高；開場的刻度不分新舊（M4 票 11）。 */
  progressAtStart?: LayoutProgress;
};

export function KnownCount({ layoutName, quizzable, stored, progressAtStart }: Props) {
  const known = groupByFamiliarity(quizzable, stored.progress).known;
  const total = quizzable.length;
  // 這一局新認得的：結算時已認識、這一局開始時還不是。兩端問同一個 `groupByFamiliarity`，問的都是讀回來的紀錄——
  // 不從這一局的作答另外推算：儲存被封鎖或寫入失敗時，兩種算法各說各話，刻度就與上面的數字對不上。
  const knownAtStart = progressAtStart && new Set(groupByFamiliarity(quizzable, progressAtStart).known);
  const freshCount = knownAtStart ? known.filter((id) => !knownAtStart.has(id)).length : 0;
  return (
    <div className={styles.known}>
      <p className={styles.knownCount}>{knownCountLabel(layoutName, known.length, total)}</p>
      {/* 刻度而不是百分比條：一格一個符號，使用者數得出還差幾個。字已經說了數字，刻度對讀螢幕的人是重複的，所以藏起來。
          新認得的排在已認識那一段的最後面：刻度是數量，不是逐個符號對位。 */}
      <div className={styles.meter} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={
              i < known.length - freshCount ? styles.filled : i < known.length ? styles.fresh : undefined
            }
          />
        ))}
      </div>
      {/* 加高的格子只看得到，所以讀螢幕的人另外聽一句；畫面上不印（`freshKnownNote`）。 */}
      {freshCount > 0 && <p className={styles.visuallyHidden}>{freshKnownNote(freshCount)}</p>}
      {/* 記不住的瀏覽器上，數字永遠是 0。緊貼著數字說出為什麼：他剛答對幾題，只看到 0 會以為網站壞了。 */}
      {!stored.canRemember && <p className={styles.storageNote}>{STORAGE_BLOCKED_NOTE}</p>}
    </div>
  );
}
