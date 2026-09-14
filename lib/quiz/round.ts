import {
  createViewerState,
  reduceViewer,
  type ViewerAction,
  type ViewerConfig,
  type ViewerState,
} from "@/lib/viewer/interaction";

// 一局（CONTEXT.md）：題目 × 題數，一題一次作答。
//
// **檢視器的狀態機包在這裡面**（docs/adr/0007）。使用者對圖做的每一件事先經過一局，再決定要不要、
// 以及怎麼交給 `reduceViewer`。這一層是純的：不碰 DOM、不讀寫 localStorage。
//
// `phase` 刻意不叫 stage——CONTEXT.md 的 Stage 是檢視器的兩段式走到哪一段，兩者不可混用。

/** 一次作答：題目是哪個符號、被點中的是哪個符號、點的是哪一個熱區。 */
export type Answer = { target: string; picked: string; hotspotId: string };

/** 答對了沒：被點中的是題目那個符號的任一處（PRD §6.3.2）。 */
export const isCorrect = (answer: Answer) => answer.picked === answer.target;

export type RoundPhase = "question" | "answered" | "finished";

export type RoundState = {
  /** 這一局依序要出的 symbol id。 */
  readonly questions: string[];
  /** 已經交出去的作答，依題序。**第幾題由它的長度決定**，不另外記一個題號。 */
  answers: Answer[];
  phase: RoundPhase;
  /**
   * 說明卡開著沒（M4 票 02）。**歸一局管，不歸檢視器**（docs/adr/0007）：自由看圖時「選定了一個熱區」就等於卡片開著，
   * 找找看不是——答對時卡片不開、按「看說明」才開，關掉之後圖仍在暫停。只有 `answered` 時可能是 true。
   */
  sheetOpen: boolean;
  viewer: ViewerState;
};

export type RoundAction =
  /** 圖框送出來的 action：手勢、點擊、鍵盤、框的尺寸。 */
  | { type: "VIEWER"; action: ViewerAction }
  /** 「下一題」。最後一題之後是結算。 */
  | { type: "NEXT" }
  /** 「看說明」。 */
  | { type: "OPEN_SHEET" }
  /** 說明卡的關閉鍵、Esc。**不清標記、不解除暫停**：自由看圖時關卡片是回到 browsing，找找看不是（spec）。 */
  | { type: "CLOSE_SHEET" };

/**
 * 作答之後、按「下一題」之前，還轉得進檢視器的 action（docs/adr/0007）。
 *
 * 暫停期間圖不回應使用者：點圖、雙擊、雙指、拖曳、鍵盤選定熱區都整個不收——不擋的話作答之後還能再圈出候選。
 * 轉得進去的只有「不是使用者在選東西」的三個：框的尺寸變了（量錯框，下一題的命中判定就錯）、
 * 鍵盤焦點走到畫面外（圖跟過去）、回到全圖。
 */
const PASSES_WHILE_ANSWERED: ReadonlySet<ViewerAction["type"]> = new Set([
  "RESIZE",
  "FOCUS_HOTSPOT",
  "RESET_VIEW",
]);

export type RoundConfig = { viewer: ViewerConfig; questions: string[] };

export function createRound({ viewer, questions }: RoundConfig): RoundState {
  return {
    questions,
    answers: [],
    phase: questions.length > 0 ? "question" : "finished",
    sheetOpen: false,
    // 出題期間視野鎖定（spec「作答」）：擋使用者自己的縮放、平移、雙擊放大，不擋第一段的自動 3×。
    // 開關是狀態機既有的那一個；一局一開始就打開，整局不關。
    viewer: reduceViewer(createViewerState(viewer), { type: "SET_FIT_LOCKED", locked: true }),
  };
}

export function reduceRound(s: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case "VIEWER": {
      if (s.phase === "finished") return s;
      if (s.phase === "answered" && !PASSES_WHILE_ANSWERED.has(action.action.type)) return s;

      const viewer = reduceViewer(s.viewer, action.action);
      if (viewer === s.viewer) return s;

      // **作答 = 這一下讓檢視器走進 `confirmed`**（CONTEXT.md「作答」）。走得進去的路只有兩條：
      // 第二段確認了一個熱區、鍵盤 Enter／空白鍵選定一個熱區。第一段圈出候選、重選、第二段沒點中都走不進去，
      // 所以不必另外判斷。出題期間檢視器從不停在 `confirmed`——作答的同一次轉移裡就退回去了（見下）。
      const picked = s.phase === "question" && viewer.stage === "confirmed" ? viewer.selected : null;
      if (!picked?.symbol_id) return { ...s, viewer };

      const answer: Answer = {
        target: s.questions[s.answers.length],
        picked: picked.symbol_id,
        hotspotId: picked.id,
      };
      return {
        ...s,
        phase: "answered",
        answers: [...s.answers, answer],
        // 答錯時直接打開題目符號的說明卡，在錯的當下就學；答對不開——他已經會的東西，不強迫再讀一次（spec）。
        sheetOpen: !isCorrect(answer),
        // **同一次轉移裡把檢視器退回閒著**：被點中的是哪一個由一局記著，不留在檢視器的 `selected` 裡。
        // 留著的話，框的寬度一變（手機轉橫）檢視器就照自己的規矩把它清掉，而作答不該因此消失。
        // 視野在確認時已經還原到第一段之前（鎖定中就是全圖），`RESELECT` 不動它。
        viewer: reduceViewer(viewer, { type: "RESELECT" }),
      };
    }

    case "NEXT": {
      if (s.phase !== "answered") return s;
      // 說明卡一律收起，展開著也收（spec）。帶著展開的卡進下一題，就是 M2 票 08 修過的情境：
      // 卡片展開時 fit 很小，第一段的定位會被夾回圖中央，而鎖定視野時連補救的平移都沒有。
      if (s.answers.length === s.questions.length) return { ...s, phase: "finished", sheetOpen: false };
      return {
        ...s,
        phase: "question",
        sheetOpen: false,
        viewer: reduceViewer(s.viewer, { type: "RESET_VIEW" }),
      };
    }

    case "OPEN_SHEET":
    case "CLOSE_SHEET": {
      const open = action.type === "OPEN_SHEET";
      return s.phase === "answered" && s.sheetOpen !== open ? { ...s, sheetOpen: open } : s;
    }
  }
}

/** 這一局答對幾題。 */
export const scoreOf = (s: RoundState) => s.answers.filter(isCorrect).length;

/**
 * 剛交出去、還沒按「下一題」的那一次作答。出題中與結算時是 null。
 *
 * 圖上的標記就從它來（docs/adr/0007「標記住在結束它的那一層」）：被點中的熱區是 `selected`、
 * 題目符號的其餘各處是 `revealed`。出題中它是 null，所以作答前沒有任何熱區帶著答案的痕跡（CONTEXT.md「State」）。
 */
export const pendingAnswer = (s: RoundState) =>
  s.phase === "answered" ? s.answers[s.answers.length - 1] : null;

/** 現在是第幾題（從 0 起）。作答之後、按「下一題」之前，仍然是剛答完的那一題。 */
export const questionIndex = (s: RoundState) =>
  s.phase === "question" ? s.answers.length : s.answers.length - 1;
