// 前台看得見的字，除了 symbol 資料本身以外，全部在這裡（PRD §3「文案與 UI 字串集中管理」）。
//
// 為什麼要集中：資料裡的 `category` 與 `source_tier` 只有 enum，沒有中文名——
// 中文名是介面文案不是內容，散在元件裡的話，同一個 tier 在說明卡、符號頁、找找看
// 會各長一個樣子，而它正是這個產品的核心主張（PRD §6.5）。

import type { SymbolCategory, SourceTier } from "@/lib/symbols/types";

/** 分類的中文名。英文小字沿用 design/Main.dc.html 的「中文 / ENGLISH」排法。 */
export const CATEGORY_LABELS: Record<SymbolCategory, { zh: string; en: string }> = {
  structure: { zh: "結構", en: "STRUCTURE" },
  door_window: { zh: "門窗", en: "DOOR & WINDOW" },
  furniture: { zh: "家具家配", en: "FURNITURE" },
};

/**
 * 四種來源徽章（PRD §6.5，樣式照 design/Badges.dc.html 的小尺寸版）。
 *
 * `note` 只給**結論**，不給出處：說明卡上寫「依〈某某設置標準〉」對站在接待中心的人
 * 沒有用，他無從點開查證。完整出處與可點連結是符號頁（M3）的事。
 */
export const SOURCE_TIER_BADGES: Record<SourceTier, { label: string; note: string }> = {
  cns: { label: "CNS 標準", note: "國家標準明文" },
  regulation: { label: "法規依據", note: "法條明文" },
  convention: { label: "業界慣例", note: "各建商畫法可能不同" },
  varies: { label: "畫法不一", note: "請以個案圖說為準" },
};

/** 說明卡上各區塊的標題。 */
export const SHEET_SECTIONS = {
  plainMeaning: "白話意思",
  caution: "注意事項",
  confusedWith: "容易搞混",
} as const;

export const SHEET_CONTROLS = {
  close: "關閉說明",
  expand: "上拉看完整內容",
  otherOccurrences: "看它在圖上的其他位置",
} as const;

/**
 * 「這張圖上共 N 處 · 目前第 M 處」。
 * N 由 floorplan.hotspots 算出來，不得寫死（PRD §6.3.2）。
 */
export const occurrenceLabel = (total: number, index: number) =>
  `這張圖上共 ${total} 處 · 目前第 ${index} 處`;

/** 「跟○○的差別」——容易搞混區塊裡每一則的標題。 */
export const confusedWithLabel = (otherName: string) => `跟${otherName}的差別`;

/** PRD §6.4 的完整一句，一字不改。每頁固定顯示。 */
export const DISCLAIMER =
  "本網站符號說明為一般通用慣例，不同建商 / 設計師畫法可能有差異，實際請以個案圖說或現場人員說明為準。";
