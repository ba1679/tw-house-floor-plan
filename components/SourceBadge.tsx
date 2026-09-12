import { SourceTierIcon } from "./SourceTierIcon";
import type { SourceTier } from "@/lib/symbols/types";
import { SOURCE_TIER_BADGES } from "@/lib/ui/copy";
import styles from "./SourceBadge.module.css";

// 來源徽章的**小尺寸版**（PRD §6.5，樣式照 design/Badges.dc.html）。這是本產品相對於
// 一般房產內容網站的核心差異化：不只給答案，而是給答案的出處——這個說法出自哪一級文件。
//
// 用在說明卡：站在接待中心的人一眼掃過。符號頁上的大尺寸版在 `SourceTierPanel`，
// 兩者共用同一套圖標與同一份文案常數——同一個 tier 在兩個地方長不一樣的話，
// 這個網站對「來源層級」的主張自己就不成立了。
//
// 該稿對 PRD §6.5 有兩處刻意改動：
//   1. emoji（📘📗🏗⚠️）換成 SVG 圖標——理由見 `SourceTierIcon`。
//   2. `varies` 用虛線框而非警告色——它不是錯誤，是誠實揭露；
//      警告色會讓使用者以為這條資料壞掉。
//
// 文案在 lib/ui/copy.ts。`cns` 與 `regulation` 的說明**沒有照抄設計稿**——
// 稿上那兩個小徽章寫的是法規名稱（「各類場所消防安全設備設置標準」），
// 而票 03 要的是「只給結論、不給出處」，所以改用同一份稿子的來源層級階梯上那兩句
// （「國家標準明文」「法條明文」）。出處是符號頁的事。

export function SourceBadge({ tier }: { tier: SourceTier }) {
  const { label, note } = SOURCE_TIER_BADGES[tier];

  return (
    <span className={styles.badge} data-tier={tier}>
      <SourceTierIcon tier={tier} size={15} className={styles.icon} />
      <span className={styles.label}>{label}</span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.note}>{note}</span>
    </span>
  );
}
