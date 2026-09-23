// Product analytics has one narrow public vocabulary. UI code imports these
// types instead of spelling GA event strings and enum values ad hoc.

export const ANALYTICS_EVENTS = {
  symbolView: "symbol_view",
  selectContent: "select_content",
  search: "search",
  layoutInteraction: "layout_interaction",
  infoSheetAction: "info_sheet_action",
  quizStart: "quiz_start",
  quizAnswer: "quiz_answer",
  quizComplete: "quiz_complete",
} as const;

export type SymbolViewEvent = {
  name: typeof ANALYTICS_EVENTS.symbolView;
  symbol_id: string;
  surface: "symbol_page" | "layout_sheet" | "quiz_sheet";
  layout_id?: string;
  hotspot_id?: string;
};

export type SelectContentEvent = {
  name: typeof ANALYTICS_EVENTS.selectContent;
  content_type:
    | "header_home"
    | "home_layout"
    | "home_quiz"
    | "category_symbol"
    | "search_result"
    | "symbol_layout"
    | "layout_quiz"
    | "quiz_review_symbol";
  item_id: string;
  origin_page_type: "home" | "category" | "symbol" | "layout" | "quiz";
};

export type SearchEvent = {
  name: typeof ANALYTICS_EVENTS.search;
  /** A known name/alias, or the privacy-preserving catch-all value. */
  search_term: string;
  result_count: number;
  search_surface: "home" | "category";
};

export type LayoutInteractionEvent = {
  name: typeof ANALYTICS_EVENTS.layoutInteraction;
  layout_id: string;
  action:
    | "candidates_shown"
    | "symbol_confirmed"
    | "confirm_missed"
    | "reselect"
    | "reset_view"
    | "manual_pan"
    | "manual_zoom";
  symbol_id?: string;
  hotspot_id?: string;
  candidate_count?: number;
  input_method?: "pointer" | "keyboard";
};

export type InfoSheetActionEvent = {
  name: typeof ANALYTICS_EVENTS.infoSheetAction;
  layout_id: string;
  symbol_id: string;
  context: "layout" | "quiz";
  action: "expand" | "collapse" | "close" | "next_occurrence";
};

export type QuizStartEvent = {
  name: typeof ANALYTICS_EVENTS.quizStart;
  layout_id: string;
  question_count: number;
  start_type: "first" | "replay";
};

export type QuizAnswerEvent = {
  name: typeof ANALYTICS_EVENTS.quizAnswer;
  layout_id: string;
  symbol_id: string;
  picked_symbol_id: string;
  hotspot_id: string;
  correct: boolean;
  question_index: number;
  input_method: "pointer" | "keyboard";
};

export type QuizCompleteEvent = {
  name: typeof ANALYTICS_EVENTS.quizComplete;
  layout_id: string;
  question_count: number;
  correct_count: number;
};

export type AnalyticsEvent =
  | SymbolViewEvent
  | SelectContentEvent
  | SearchEvent
  | LayoutInteractionEvent
  | InfoSheetActionEvent
  | QuizStartEvent
  | QuizAnswerEvent
  | QuizCompleteEvent;
