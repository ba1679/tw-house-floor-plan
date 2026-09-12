import { SourceTierIcon } from "./SourceTierIcon";
import type { SourceTier } from "@/lib/symbols/types";
import { SOURCE_TIER_BADGES } from "@/lib/ui/copy";
import styles from "./SourceTierPanel.module.css";

// 來源徽章的**大尺寸版**（design/Badges.dc.html「大尺寸」那一組）。用在符號頁：
// 它排在標題底下、圖形之前，因為搜尋進來的人第一個要判斷的是「這一頁憑什麼」——
// 那正是這個產品與內容農場的差別（PRD §6.5）。
//
// **不印 `SOURCE_TIER: CONVENTION` 那一行。** 設計稿上有，但那是給看稿的人對照 enum 用的；
// 站在接待中心的首購族看到一串英文常數，得到的資訊不比那句中文多。
//
// 這裡**只說 tier，不說 verification_status**：那是兩條不同的軸，
// 一條講「答案從哪來」、一條講「我們查證做到哪」，不可互相取代或合併顯示（CONTEXT.md）。
// 完整出處清單（`source_refs`）長在這個區塊底下，是另一張票的事。

export function SourceTierPanel({ tier }: { tier: SourceTier }) {
  const { label, explainer } = SOURCE_TIER_BADGES[tier];

  return (
    <div className={styles.panel} data-tier={tier}>
      <div className={styles.head}>
        <span className={styles.iconBox}>
          <SourceTierIcon tier={tier} size={19} />
        </span>
        <span className={styles.label}>{label}</span>
      </div>
      <p className={styles.explainer}>{explainer}</p>
    </div>
  );
}
