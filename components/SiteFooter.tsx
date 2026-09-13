import { DISCLAIMER } from "@/lib/ui/copy";
import styles from "./SiteFooter.module.css";

// PRD §6.4 的「每頁固定顯示」。掛在根版面上，所以**頁面不必知道自己要掛免責**——
// 票 05 的分類頁、票 07 的首頁一產生就有，不必各自記得補一份，也就不會有人忘記。
//
// 說明卡底部那一份保留（`components/InfoSheet.tsx`）：兩份服務的是不同時刻的同一個人。
// 卡片升起來時**頁尾讓位**，畫面上任何一刻都剛好一份——卡片是版面裡的一列、不是浮層，
// 蓋不住頁尾。讓位的機制與理由在 `SiteFooter.module.css`。
//
// 這裡沒有連結、沒有按鈕，只有一句話。頁尾一旦有可聚焦的東西，它就會站在每一頁
// 每一條 Tab 路徑的盡頭——而這句話是給讀到的人看的，不是給人操作的。

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>{DISCLAIMER}</p>
    </footer>
  );
}
