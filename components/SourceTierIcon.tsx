import type { SourceTier } from "@/lib/symbols/types";

// 四種來源的圖標，說明卡的小徽章與符號頁的大徽章共用一套。
//
// 為什麼是 SVG 而不是 emoji（PRD §6.5 原本寫 📘📗🏗⚠️）：emoji 在 Android / Windows / iOS
// 各長一樣，一個主打「精準」的產品不該把品牌主張交給平台字型。
//
// 四級之間的階梯不用顏色表示，用**這個網站正在教的線型語彙**表示——
// 實線＝有明文依據，虛線＝畫法分歧。那條階梯畫在各自徽章的 CSS 裡，這裡只管形狀。

const PATHS: Record<SourceTier, React.ReactNode> = {
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

export function SourceTierIcon({
  tier,
  size,
  className,
}: {
  tier: SourceTier;
  size: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {PATHS[tier]}
    </svg>
  );
}
