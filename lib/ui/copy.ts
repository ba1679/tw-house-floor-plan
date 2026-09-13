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
 * 四種來源徽章（PRD §6.5，樣式照 design/Badges.dc.html 的小／大兩種尺寸）。
 *
 * `note` 只給**結論**，不給出處：說明卡上寫「依〈某某設置標準〉」對站在接待中心的人
 * 沒有用，他無從點開查證。完整出處與可點連結是符號頁的事。
 *
 * `explainer` 是符號頁那個大尺寸徽章上的一整句（文字照設計稿）。同一件事在兩個地方
 * 長度不同，不是兩件事：說明卡是站著看的，一眼掃過；符號頁是搜尋落地頁，讀者是來
 * 判斷「這個答案硬到什麼程度」的，值得多給他一句。
 */
export const SOURCE_TIER_BADGES: Record<
  SourceTier,
  { label: string; note: string; explainer: string }
> = {
  cns: {
    label: "CNS 標準",
    note: "國家標準明文",
    explainer: "此符號的畫法在中華民國國家標準中有明文規定。",
  },
  regulation: {
    label: "法規依據",
    note: "法條明文",
    explainer: "此符號或其設置規定，在現行法規中有明文條文。",
  },
  convention: {
    label: "業界慣例",
    note: "各建商畫法可能不同",
    explainer: "常見於台灣建築圖說，但沒有標準或法規明文，不同建商可能有不同畫法。",
  },
  varies: {
    label: "畫法不一",
    note: "請以個案圖說為準",
    explainer:
      "查到的來源彼此分歧。這不是我們沒查，是實務上真的沒有統一畫法——請以個案圖說為準。",
  },
};

/**
 * 各區塊的標題，說明卡與符號頁共用。
 *
 * **兩邊的順序刻意不同**（說明卡是站著看的，符號頁是搜尋落地頁，「容易搞混」排在
 * 「注意事項」前面），但**名字必須一樣**：同一個區塊在兩處各叫一個名字，會讓讀者
 * 以為那是兩種東西。
 */
export const SECTION_LABELS = {
  plainMeaning: "白話意思",
  caution: "注意事項",
  confusedWith: "容易搞混",
  /** **符號頁獨有。** 說明卡只給結論（見上面 `note`），完整出處是坐下來讀的人才要的。 */
  sources: "出處",
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

/**
 * 符號頁的標題——**一個問句，不是把 `name` 印出來**。
 *
 * 這一頁的讀者多半是在 Google 打完「平面圖上的虛線是什麼」之後點進來的，標題要長得像
 * 他剛才打的那句話，他才在一排搜尋結果裡認得出這一條值得點（PRD §6.2.1）。
 * 頁面的 `<title>` 與 `<h1>` 同一句：搜尋結果上那一行與落地後看到的第一行不該是兩句話。
 */
export const symbolPageTitle = (name: string) => `平面圖上的${name}是什麼？`;

/**
 * 符號頁的 meta description。前半是資料裡的白話意思——他要的答案，搜尋結果上就先給他；
 * 後半是本站與內容農場的差別，也就是他點進來之後會拿到的額外東西。
 */
export const symbolPageDescription = (plainMeaning: string) =>
  `${plainMeaning}本頁同時標示這個說法出自哪一級文件，你可以自己判斷要不要信。`;

/**
 * 符號圖形的替代文字。圖不是裝飾：它是這一頁在教的東西，讀螢幕的人要知道
 * 那畫的是這個符號**在平面圖上**的樣子，而不是一張照片或圖示。
 */
export const symbolArtLabel = (name: string) => `${name}在平面圖上的畫法`;

/**
 * 分類頁的標題——與符號頁同一個作法：**長得像使用者打進 Google 的那句話**
 * （「平面圖 門窗符號 有哪些」），不是把分類的中文名直接當標題。
 * 頁面的 `<title>` 與 `<h1>` 同一句，理由同 `symbolPageTitle`。
 *
 * 中文名由呼叫端從 `CATEGORY_LABELS` 取來再傳進來，這裡不自己查——與 `symbolPageTitle` 收
 * `name` 同一個形狀：這一區的函式只負責把字排成一句話，查表留在手上拿著有型別 id 的呼叫端。
 */
export const categoryPageTitle = (zh: string) => `平面圖上的${zh}符號有哪些？`;

/**
 * 分類頁的 meta description——**把這一類有哪些符號直接數給搜尋結果看**。
 *
 * 三張分類頁共用一句「瀏覽本站收錄的符號」的話，搜尋引擎會把它們當成同一頁（spec user story 31）；
 * 名字則是從資料算出來的，哪天某一類多收一個符號，這一行自己跟著長。
 */
export const categoryPageDescription = (zh: string, names: string[]) =>
  `${zh}類的平面圖符號共 ${names.length} 個：${names.join("、")}。` +
  `每一個都說得出它是什麼，以及這個說法出自哪一級文件。`;

/**
 * 「共 N 個符號」。N 由該分類底下的符號算出來，不得寫死（同 `occurrenceLabel`）——
 * 讀者往下捲之前先知道這一類有幾個，捲完之後自己數得出來的必須是同一個數字。
 */
export const categoryCountLabel = (count: number) => `共 ${count} 個符號`;

/**
 * 搜尋框的標籤。**說出它搜的是全部**：放在分類頁上的搜尋框，讀者會以為它只搜這一類。
 * N 由索引算出來，不得寫死（同 `categoryCountLabel`）。
 *
 * 它是看得見的 `<label>`，不是 placeholder：placeholder 一打字就消失，讀者打到一半就忘了這個框搜的是什麼。
 */
export const searchLabel = (total: number) => `搜尋全部 ${total} 個符號`;

/** 「找到 N 個符號」。N 是列出來的那幾個，不得另外算——讀者數得出來的必須是同一個數字。 */
export const searchResultCount = (count: number) => `找到 ${count} 個符號`;

/**
 * 沒有命中時的那一句。**把他打的字複述回去**：他才看得出是自己打錯了，還是這裡真的沒有。
 * 一片空白的話，他分不出「沒有這個符號」與「搜尋壞了、還在等」。
 */
export const searchNoResult = (query: string) => `找不到符合「${query}」的符號`;

/**
 * 結果列上的「又稱「流理台」」。**只在別名對上、名字沒對上時出現**：打「流理台」看到「廚具」的人
 * 要看得出為什麼是它，否則他會以為搜尋找錯了；名字本身就對上時不必解釋。
 * 印的是資料裡的原文，不是正規化之後的樣子（`SearchHit.matchedAlias`）。
 */
export const searchAliasHint = (alias: string) => `又稱「${alias}」`;

/**
 * 轉載那一行：經由他人文件讀到某份標準，而未核對標準原文（CONTEXT.md「轉載」）。
 *
 * 印出來的成本是承認自己沒翻過原文，不印的代價是讀者以為我們翻過——
 * 一個網站的主張若是「你可以自己判斷要不要信」，就不能在這一行上省字。
 */
export const viaLabel = (via: string) => `轉載自：${via}`;

/**
 * 出處連結的字。**帶著文件名**：雨遮那一頁有兩筆來源，兩個連結都叫「看原文」的話，
 * 讀螢幕的人聽到的是兩個一模一樣的連結，分不出哪個通往哪裡（PRD §9）。
 */
export const sourceLinkLabel = (doc: string) => `看《${doc}》原文`;
