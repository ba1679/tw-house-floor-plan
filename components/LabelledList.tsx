import type { ReactElement } from "react";
import styles from "./Quiz.module.css";

// 找找看開場與結算上的清單：一個標題、底下一串，清單以標題命名（`aria-labelledby`）——讀螢幕的人走進清單時，聽得到這是哪一份。
//
// 開場的三份熟悉度清單與結算的答錯清單長同一個樣子（M4 票 05），所以只寫一份：各寫一份的話，
// 哪天一邊改了標題的層級或命名方式、另一邊沒改，同一個畫面上就有兩種讀法。
// **一個項目都沒有時整份不印**：只有標題的空清單是雜訊。

type Props = {
  /** 標題的 id 由它組出來（`{id}-heading`）：同一頁上的幾份清單各自不重複。 */
  id: string;
  heading: string;
  /** 清單本身的排法：一列一個，或會折行的一串。 */
  className: string;
  children: ReactElement[];
};

export function LabelledList({ id, heading, className, children }: Props) {
  if (children.length === 0) return null;
  const headingId = `${id}-heading`;
  return (
    <>
      <h2 id={headingId} className={styles.listHeading}>
        {heading}
      </h2>
      <ul aria-labelledby={headingId} className={className}>
        {children}
      </ul>
    </>
  );
}
