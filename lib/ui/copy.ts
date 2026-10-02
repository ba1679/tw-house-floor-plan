// 前台看得見的字，除了 symbol 資料本身以外，全部在這裡（PRD §3「文案與 UI 字串集中管理」）。
//
// 為什麼要集中：資料裡的 `category` 與 `source_tier` 只有 enum，沒有中文名——
// 中文名是介面文案不是內容，散在元件裡的話，同一個 tier 在說明卡、符號頁、找找看
// 會各長一個樣子，而它正是這個產品的核心主張（PRD §6.5）。

import type { Familiarity } from "@/lib/quiz/progress";
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
  expand: "展開完整內容",
  collapse: "收合看平面圖",
  otherOccurrences: "看它在圖上的其他位置",
} as const;

/**
 * 「這張圖上共 N 處」。N 由 floorplan.hotspots 算出來，不得寫死（PRD §6.3.2）。
 * 找找看的說明卡只印這一句（M4 票 02）：每一處已經都標在圖上了。
 */
export const occurrenceTotalLabel = (total: number) => `這張圖上共 ${total} 處`;

/** 「這張圖上共 N 處 · 目前第 M 處」：自由看圖的說明卡。前半與找找看是同一句。 */
export const occurrenceLabel = (total: number, index: number) =>
  `${occurrenceTotalLabel(total)} · 目前第 ${index} 處`;

/**
 * 符號頁底部那顆轉換點按鈕的字，照 PRD §6.2.1 的原句。它是把搜尋流量帶進平面圖的唯一入口（M3 票 08）。
 *
 * 「真實格局」是跟同一頁上那張符號圖形對照著說的：讀者剛看完的是一個圖例，按下去看的是它長在一張真的圖上。
 *
 * **不帶格局名**。樑的那一顆（票 09）自己就寫著「這張三房兩廳上看不到樑」，在按鈕上另外印一次格局名會與它重複，
 * 票 09 就得替樑另開一條畫法——而那張票明講不為樑開分支。代價落在第 2 張圖進來的那一天：
 * 一頁上兩顆按鈕的字一模一樣，那時要回頭換這一句（`app/symbols/[id]/page.tsx`）。
 */
export const SYMBOL_LAYOUT_BUTTON = "這個符號在真實格局裡長怎樣";

/**
 * 符號在那個 layout 上 0 處時，轉換點按鈕換成這一句（PRD §6.2.1 的例外，M3 票 09）。今天只有樑：建案平面圖不畫樑（PRD §4.2）。
 *
 * **誠實說看不到**，不說「這個符號在真實格局裡長怎樣」——那會帶讀者去找一個不存在的東西，
 * 他進去之後找不到，會以為網站壞了（spec user story 18）。按下去照樣是同一個網址、同一個機制：「圖上找不到」本身就是內容。
 *
 * 帶格局名：「看不到」要說得出是在哪一張圖上。名字由呼叫端從 floorplan 取來，不寫死三房兩廳。
 */
export const absentSymbolButton = (layoutName: string, symbolName: string) =>
  `這張${layoutName}上看不到${symbolName}——這正是重點`;

/**
 * 從「看不到」那顆按鈕進來時，平面圖上那條橫幅（M3 票 09）。
 *
 * - `lead` 接著他剛按下的那一句說：他到對地方了，圖上確實沒有——不是網站壞了（spec user story 18）。
 * - `reason` 說為什麼。「看不到」這件事本身就是他要學的東西（user story 19）：你看不到它，所以要問。
 * - `dismiss` 是關掉它的那顆按鈕。字而不是一個 ×：站在接待中心單手拿手機的人，一個 × 要猜；「知道了」不必。
 *
 * **`reason` 是為樑寫的**（PRD §4.2：建案平面圖不畫樑，它在施工圖與結構圖上）。今天圖上 0 處的符號只有樑；
 * 第二個出現時，`scripts/validate_data.py` 那條「宣稱在某張圖上、該圖卻沒有熱區」的 warning 會提醒回來看這一句。
 */
export const absentSymbolBanner = (layoutName: string, symbolName: string) => ({
  lead: `這張${layoutName}上看不到${symbolName}。`,
  reason: `建案平面圖多半不畫${symbolName}，它在施工圖與結構圖上。你看不到它，所以要問建商。`,
  dismiss: "知道了",
});

/**
 * 從符號頁落地時，平面圖的狀態列說的那一句（M3 票 08；規格主人 2026-09-13 的決定 D2）。
 * N 由 floorplan.hotspots 算出來，不得寫死（同 `occurrenceLabel`）。對到 0 處時呼叫端不說這一句——那是樑，由橫幅接手。
 */
export const highlightStatus = (name: string, total: number) =>
  `${name}在這張圖上共 ${total} 處，都亮起來了。`;

/**
 * 網址的 `?symbol=` 對不到任何符號時，平面圖的狀態列說的那一句（決定 D4）。
 *
 * **不照印網址裡的字。**網址是別人造得出來的，照印等於讓第三方在這一頁上寫字——這與 `searchNoResult`
 * 把讀者打的字複述回去不同，那是他自己打的。後半句給一個看得懂的原因，他才知道不是網站壞了。
 */
export const SYMBOL_NOT_FOUND = "找不到網址指定的符號，網址可能不完整。";

/**
 * 第一次進站的那一句話（PRD §6.1.2 v0.5）。它刻意不說「點擊圖上的標記」——
 * 那句話要求使用者點準一個比指尖還小的東西，而兩段式存在的理由正是拆掉這個預設。
 *
 * 平面圖頁與找找看頁**共用同一句、同一個記錄**（`useFirstVisitHint`）：在哪一頁先看到都算看過。
 */
export const TAP_HINT = "點圖上任何一個位置，我們會放大讓你看清楚";

/** 檢視器控制列的兩顆按鈕（M2 票 03、04）。平面圖頁與找找看共用同一個圖框，也共用這兩個字。 */
export const VIEWER_CONTROLS = { reselect: "重選", resetView: "回到全圖" } as const;

/**
 * 第一段圈出候選之後狀態列那一句。**只說數量、不說是哪些符號**：找找看作答前，
 * 畫面與讀螢幕軟體念得出來的東西都不得出現熱區的符號名字（PRD §6.3.1）。
 */
export const candidatesStatus = (count: number) =>
  `放大了，圈出 ${count} 個候選。再點一次確認你要的那一個。`;

/** 第二段沒點中。沒有這一句，畫面上的字跟成功時一模一樣，使用者不知道剛剛那一下有沒有被聽見。 */
export const CONFIRM_MISSED_STATUS = `還是沒點到。再點一次，或按「${VIEWER_CONTROLS.reselect}」退回第一段。`;

/** 點到附近沒有熱區的地方。雙擊只在這之後成立，而那一刻畫面上唯一的字就是這句——沒有它，手機上沒有人會去猜雙擊。 */
export const BLANK_TAP_STATUS = "這附近沒有可以點的東西，換個地方點點看，或連點兩下放大這一區。";

/**
 * 找找看裡熱區的替代文字：「主臥 · 第 3 個可以點的東西」（M4 票 03）。**不含符號名字**——作答之前，
 * 讀螢幕軟體念得出來的東西裡不得有答案（PRD §6.3.1）；作答之後也只有圖上標出來的那幾個改念名字（圖框的 `names`）。
 *
 * 「可以點的東西」沿用上面那句狀態列的說法（CONTEXT.md 的 Hotspot 避免用「標記」）。
 * k 是熱區在那一間房裡的閱讀順序，也就是 Tab 走到它的先後。房間內依類別排，會透露一點類別資訊，spec 寫明接受：
 * 改依座標的話，這一個念「第 3 個」、Tab 的下一個念「第 1 個」。
 */
export const neutralHotspotLabel = (roomName: string, k: number) =>
  `${roomName} · 第 ${k} 個可以點的東西`;

/** 「跟○○的差別」——容易搞混區塊裡每一則的標題。 */
export const confusedWithLabel = (otherName: string) => `跟${otherName}的差別`;

/** 第一方識別共用文字；標記圖形由 BrandMark 擁有（ADR-0009）。 */
export const SITE_NAME = "拼厝";
export const SITE_ROMANIZATION = "Phin-Chhù";
export const SITE_IDENTITY = `${SITE_NAME}（${SITE_ROMANIZATION}）`;
export const BRAND_PROMISE = "看懂格局，慢慢拼成家。";
export const SITE_PURPOSE = "教你看懂建案平面圖與格局";
export const BRAND_IMAGE_ALT = `${SITE_NAME}：由平面圖方格拼成的台灣意象`;

/**
 * 首頁那一句主張，照 PRD §8 資訊架構圖上的原句。
 *
 * 一個問句而不是介紹：讀者多半以為自己看得懂平面圖，這一句先讓他懷疑一下，底下那個按鈕才有人按。
 * 「這裡在幹嘛」由緊接著的 `SITE_PURPOSE` 說。換行直接由文案指定，CSS pre-line 呈現。
 */
export const HOME_CLAIM = "一張平面圖，\n你真的\n看得懂嗎？";

/**
 * 這個網站替你做什麼的那一句。首頁、平面圖頁、根版面的 meta description 都由它組出來——
 * 同一個承諾在四個地方各寫一版，改一處就漏三處。一句，不展開成產品敘事（票 07「要小」）。
 */
export const SITE_TAGLINE = "點圖上的符號，就知道它是什麼、該注意什麼，以及這個說法出自哪一級文件。";

/**
 * 首頁的標題。與平面圖頁的標題**對照著取**（`layoutPageTitle`，票 07）：這一頁是站上唯一一頁以
 * 網站本身為主題的頁，所以站名在前；平面圖頁說的是那一張圖。
 *
 * 與 `HOME_CLAIM` 刻意不同句，與符號頁、分類頁「`<title>` 與 `<h1>` 同一句」的規矩不同：那兩種頁是
 * 搜尋落地頁，標題要長得像使用者打的那句話；首頁的主張是一個問句，放進搜尋結果裡看不出這是哪個網站。
 */
export const HOME_PAGE_TITLE = `${SITE_IDENTITY}：看懂建案平面圖上的符號`;

/** 首頁的 meta description：這個網站替誰做什麼，以及站上有哪幾條路（進圖、搜尋、依分類）。 */
export const HOME_PAGE_DESCRIPTION = `${SITE_IDENTITY}${SITE_PURPOSE}：${SITE_TAGLINE}也可以直接搜尋，或依分類瀏覽。`;

/**
 * 首頁讀圖桌的主 CTA（拼厝票 03），一個 layout 一個。**格局名由呼叫端從 floorplan 資料取來**，
 * 不寫在這裡：寫死「三房兩廳」，M7 加第 2 張圖時這一行就是第二份會跟資料分岔的名字。
 */
export const homeLayoutButton = (layoutName: string) => `讀這張圖：${layoutName}`;

/**
 * 平面圖頁標題列上那個進找找看的入口（M4 票 06）。**不帶格局名**：它就排在寫著格局名的 `<h1>` 旁邊。
 * **短**：與 `<h1>` 擠在 375px 的同一列，折成兩行就從圖框挖走一行的高度（ADR-0003）。
 */
export const LAYOUT_QUIZ_LINK = "找找看：你認得幾個？";

/**
 * 首頁進找找看的入口，一張有可出題符號的圖一個（M4 票 06）。第一次到首頁的人可以直接從玩開始。
 * 是同一句話前面接上格局名：首頁上沒有 `<h1>` 替它說是哪一張圖。格局名由呼叫端從 floorplan 取來，理由同 `homeLayoutButton`。
 */
export const homeQuizButton = (layoutName: string) => `${layoutName}${LAYOUT_QUIZ_LINK}`;

/** 首頁分類入口那一區的標題。 */
export const HOME_BROWSE_LABEL = "依分類瀏覽";

/**
 * 平面圖頁的標題。與首頁的標題**對照著取**（票 07）：首頁說的是這個網站，這一頁說的是這一張圖——
 * 在一排搜尋結果裡，兩條要看得出是兩頁。與符號頁、分類頁同一個作法，長得像使用者會打進 Google 的那句話。
 *
 * **這一句只進 `<title>`，不進 `<h1>`**，與符號頁、分類頁那條「兩者同一句」的規矩刻意不同，
 * 理由寫在 `app/layouts/[id]/page.tsx` 的 `generateMetadata`。
 * 格局名由呼叫端從 floorplan 資料取來，理由同 `homeLayoutButton`。
 */
export const layoutPageTitle = (layoutName: string) => `${layoutName}平面圖怎麼看？`;

/** 平面圖頁的 meta description：這是哪一張圖，加上這個網站替你做什麼（`SITE_TAGLINE`）。 */
export const layoutPageDescription = (layoutName: string) =>
  `一張點得動的${layoutName}平面圖。${SITE_TAGLINE}`;

/**
 * 找找看頁的標題與描述（M4）。這一頁 noindex、不進 sitemap——一局的題目是隨機的，搜尋結果上沒有東西可給人看——
 * 但分頁上、瀏覽紀錄裡仍然看得到標題，所以它要與平面圖頁分得開。格局名由呼叫端從 floorplan 取來，理由同 `homeLayoutButton`。
 */
export const quizPageTitle = (layoutName: string) => `${layoutName}找找看：這張平面圖上的符號你認得幾個？`;

export const quizPageDescription = (layoutName: string) =>
  `在一張${layoutName}平面圖上，照題目把符號找出來，看看自己認得幾個。`;

/**
 * 找找看頁的 `<h1>`。**短**：這一頁與平面圖頁一樣是 100dvh 的版面，`<h1>` 在 375px 上折成兩行，
 * 圖框就跟著變矮（ADR-0003，理由寫在 `app/layouts/[id]/page.tsx` 的 `generateMetadata`）。
 */
export const quizHeading = (layoutName: string) => `${layoutName}找找看`;

/**
 * 開場那一句。**說出一局幾題**（題數由可出題符號算，不得寫死），並告訴他作答就是平常看圖的點法——
 * 他不必另外學一套操作：點大略位置、圖放大、再點一下確認，那一下就是答案。
 */
export const quizIntro = (total: number) =>
  `一局 ${total} 題。題目說一個符號，你在圖上把它找出來——照平常看圖的方式點就好，確認的那一下就是你的答案。`;

export const QUIZ_START = "開始";

/** 「第 3 / 7 題」。兩個數字都由呼叫端算，不寫死。 */
export const quizProgress = (index: number, total: number) => `第 ${index} / ${total} 題`;

/** 題目句型。後面接的符號名字是 `symbol.name` 原文，含括號（spec「一局的流程」）。 */
export const QUIZ_PROMPT_LEAD = "找出這張圖上的";

/**
 * 作答之後狀態列那一句。**只說對或錯**，不誇獎、不責備（spec「一局的流程」）：這是工具，不是遊戲化產品。
 * 放在狀態列（role="status"）而不是另外一行：用鍵盤作答的人聽得到結果。
 */
export const QUIZ_CORRECT = "答對了。";
export const QUIZ_WRONG = "答錯了。";

/** 作答之後前進的那一顆。最後一題按下去是結算，字照樣是「下一題」（spec「作答之後」的原文）。 */
export const QUIZ_NEXT = "下一題";

/** 作答之後打開題目符號說明卡的那一顆（M4 票 02）。答對時卡片不自動打開，想看的人按它。 */
export const QUIZ_SHOW_SHEET = "看說明";

/**
 * 答錯時說明卡最上面那一句（spec「作答之後」）。卡片講的是題目符號，這一句先告訴他：他把什麼當成了它。
 * 名字是 `symbol.name` 原文，由呼叫端從資料取來。
 */
export const quizPicked = (pickedName: string) => `你點的是${pickedName}。`;

/** 結算那一行。兩個數字都由一局算，不寫死。 */
export const quizScore = (correct: number, total: number) => `答對 ${correct} / ${total} 題`;

export const QUIZ_PLAY_AGAIN = "再玩一次";

/**
 * 開場與結算那一行，照 PRD §6.6 的原句（「這張三房兩廳你認得 11 / 13」）。M4 票 05。
 * **分母是可出題符號數**，由資料算、不寫死；格局名由呼叫端從 floorplan 取來，理由同 `homeLayoutButton`。
 * 這一行只在讀到 localStorage 之後才印：靜態 HTML 先印一個 0 再跳成真的數字，那一瞬間的 0 就是進度條在說謊。
 */
export const knownCountLabel = (layoutName: string, known: number, total: number) =>
  `這張${layoutName}你認得 ${known} / ${total}`;

/**
 * 結算時，這一局新認得了幾個——**只念給讀螢幕軟體聽**，接在「你認得 N / M」後面（DESIGN.md「學習進度的刻度」，2026-09-19 定）。
 * 看得見的人從刻度上加高的格子看得出來；刻度對讀螢幕軟體藏起來了，這一句補上它說的事。畫面上不印：「不加字」照舊。
 * N 由呼叫端算（`KnownCount`）；**0 個時不說**，理由同不加字：「這一局沒有新認得的」讀起來像責備。
 */
export const freshKnownNote = (count: number) => `這一局新認得 ${count} 個`;

/** 「認得」只有一個定義（spec Solution），開場印在數字底下：看過說明卡不算；這份紀錄也不跟著人換裝置走。 */
export const KNOWN_DEFINITION = "在找找看裡答對過至少一次，就算你認得了。進度只存在這台裝置上。";

/**
 * 開場三份清單的標題（PRD §6.6.1 的三態）。還不熟排最前面：使用者來這裡是想知道還差什麼。
 * 「錯 N 次」與「還沒遇到」是兩種不熟，所以是兩份清單，不併成一份。
 */
export const FAMILIARITY_LABELS: Record<Familiarity, string> = {
  missed: "還不熟",
  unseen: "還沒遇到",
  known: "已認識",
};

/** 還不熟清單每一列後面的次數。N 由紀錄算。 */
export const wrongTimesLabel = (count: number) => `錯 ${count} 次`;

/**
 * 結算的答錯清單標題。寫「**之後**會再出現」，不寫「下一局」：出題優先的是還沒遇到的，
 * 主圖第二局只剩 1 個空位給答錯過的（PRD §6.3）。只說它會回來，不誇獎、不責備。
 */
export const QUIZ_REVIEW_HEADING = "答錯的，之後會再出現";

/**
 * 答錯清單的一列，點下去到題目符號的符號頁（spec「一局的流程」的原句）——那是比說明卡完整的第二次學習。
 * 兩個名字都是 `symbol.name` 原文，由呼叫端從資料取來。
 */
export const quizReviewRow = (targetName: string, pickedName: string) =>
  `${targetName} · 你答成了${pickedName}`;

/** 結算的另一個出口。想自由看圖、湊近看標記的人從這裡走（PRD §6.3.3）。 */
export const QUIZ_BACK_TO_PLAN = "回到平面圖";

/**
 * 瀏覽器不讓網站存資料時，「你認得 N / M」底下那一句（M4 票 05，規格主人 2026-09-15 裁定）。
 * 那時照樣出題、照樣作答，只是不記，數字永遠是 0（PRD §6.3.3）。只印一個 0，剛答對幾題的人會以為網站壞了
 * （spec user story 42 要防的正是這件事）：說出是瀏覽器不讓存，他才知道不是網站壞了。
 */
export const STORAGE_BLOCKED_NOTE = "這台瀏覽器不讓網站存資料，答過的題目不會被記住。";

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
