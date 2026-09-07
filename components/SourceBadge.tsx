import type { SourceTier } from "@/lib/symbols/types";
import { SOURCE_TIER_BADGES } from "@/lib/ui/copy";
import styles from "./SourceBadge.module.css";

// 來源徽章（PRD §6.5）。這是本產品相對於一般房產內容網站的核心差異化：
// 不只給答案，而是給答案的出處與可信度。
//
// 樣式照 design/Badges.dc.html 的**小尺寸版**，該稿對 PRD §6.5 有兩處刻意改動：
//   1. emoji（📘📗🏗⚠️）換成 SVG 圖標——emoji 在 Android / Windows / iOS 各長一樣，
//      一個主打「精準」的產品不該把品牌主張交給平台字型。
//   2. `varies` 用虛線框而非警告色——它不是錯誤，是誠實揭露；
//      警告色會讓使用者以為這條資料壞掉。
//
// 可信度階梯不用顏色表示，用**這個網站正在教的線型語彙**表示：
// 實線＝有明文依據，虛線＝畫法分歧，填色深淺再疊一層權威感。
//
// 文案在 lib/ui/copy.ts；這裡只有圖形。

const ICONS: Record<SourceTier, React.ReactNode> = {
  // 攤開的書：國家標準。
  cns: (
    <>
      <path d="M10 5.2v11.3" />
      <path d="M10 5.2C8 3.7 5.6 3.3 3 3.6v11.2c2.6-.3 5 .1 7 1.7" />
      <path d="M10 5.2c2-1.5 4.4-1.9 7-1.6v11.2c-2.6-.3-5 .1-7 1.7" />
    </>
  ),
  // 折角的條文：法規。
  regulation: (
    <>
      <path d="M4 3h9l3.5 3.5V17H4z" />
      <path d="M12.5 3v4h4" />
      <path d="M6.5 11h7M6.5 14h4.5" />
    </>
  ),
  // 三角板：業界慣例——畫圖的工具，不是文件。
  convention: (
    <>
      <path d="M3 16.5h14L3 3.5z" />
      <path d="M6 14.2h3.4" />
    </>
  ),
  // 一分為二、其中一條是虛線：畫法分歧。
  varies: (
    <>
      <path d="M2.5 10h4" />
      <path d="M6.5 10l4-4.5h7" />
      <path d="M6.5 10l4 4.5h7" strokeDasharray="2.4 2.2" />
    </>
  ),
};

export function SourceBadge({ tier }: { tier: SourceTier }) {
  const { label, note } = SOURCE_TIER_BADGES[tier];

  return (
    <span className={styles.badge} data-tier={tier}>
      <svg
        className={styles.icon}
        width="15"
        height="15"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {ICONS[tier]}
      </svg>
      <span className={styles.label}>{label}</span>
      <span className={styles.divider} aria-hidden="true" />
      <span className={styles.note}>{note}</span>
    </span>
  );
}
