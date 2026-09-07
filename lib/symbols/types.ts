// Symbol（符號）是內容，與任何一張圖無關（CONTEXT.md）。
// 這裡只宣告前台真的會顯示的欄位——把整份 schema 抄成 TS 型別，抄來的那一份不會跟著資料走。
//
// 刻意不含 `verification_status`：它與 `source_tier` 是兩條不同的軸（CONTEXT.md），
// 描述的是「我們查證做到哪」而不是「答案從哪來」，**不上前台**。型別裡沒有它，
// 就沒有人會不小心把它畫成第五種徽章。

/** 答案出自哪一級文件。四種各有自己的徽章（PRD §6.5）。 */
export type SourceTier = "cns" | "regulation" | "convention" | "varies";

/** 階段一的三類。中文名不在資料裡，在 lib/ui/copy.ts。 */
export type SymbolCategory = "structure" | "door_window" | "furniture";

/** 「這個容易跟哪個搞混、差別在哪」。雙向登錄，build 時檢查（PRD §7.2.2）。 */
export type ConfusedWith = {
  symbol_id: string;
  difference: string;
};

export type SymbolRecord = {
  id: string;
  name: string;
  category: SymbolCategory;
  /** 一句白話：三秒內知道那是什麼。 */
  plain_meaning: string;
  /**
   * 買房時要注意什麼。**14 個裡只有雨遮有**，其餘為 null——
   * caution 要的是法規來源，不能從製圖規範推導（symbols.sample.json 的 _meta.content_state）。
   * null 時說明卡上整個區塊不出現，不留標題也不留空白。
   */
  caution: string | null;
  source_tier: SourceTier;
  confused_with: ConfusedWith[];
};
