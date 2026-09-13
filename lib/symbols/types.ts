// Symbol（符號）是內容，與任何一張圖無關（CONTEXT.md）。
// 這裡只宣告前台真的會顯示的欄位——把整份 schema 抄成 TS 型別，抄來的那一份不會跟著資料走。
//
// 刻意不含 `verification_status`：它與 `source_tier` 是兩條不同的軸（CONTEXT.md），
// 描述的是「我們查證做到哪」而不是「答案從哪來」，**不上前台**。型別裡沒有它，
// 就沒有人會不小心把它畫成第五種徽章。

/** 答案出自哪一級文件。四種各有自己的徽章（PRD §6.5）。 */
export type SourceTier = "cns" | "regulation" | "convention" | "varies";

/**
 * 階段一的三類。中文名不在資料裡，在 lib/ui/copy.ts。
 *
 * **與 `scripts/validate_data.py` 的 `VALID_CATEGORIES` 是同一份清單的兩個抄本**——驗證器是 Python，
 * 讀不到這裡。改一邊要改另一邊；`tests/build-validation.spec.ts` 比對兩者，分岔時會說。
 */
export type SymbolCategory = "structure" | "door_window" | "furniture";

/** 「這個容易跟哪個搞混、差別在哪」。雙向登錄，build 時檢查（PRD §7.2.2）。 */
export type ConfusedWith = {
  symbol_id: string;
  difference: string;
};

/**
 * 一筆出處：這個說法從哪份文件的哪一頁來。
 *
 * 除了 `doc` 以外全是選填，而**缺席一律是安全的**——現況 15 筆沒有任何一筆有 `url`，
 * 渲染端因此不得把任何一欄當成一定有：少一欄就少印一行，不是少印一筆來源。
 */
export type SourceRef = {
  /** 文件名。唯一必填的一欄——說不出是哪份文件的出處不算出處。 */
  doc: string;
  /**
   * 條次、頁碼、表號，加一句足以辨認的短引。
   * **是定位資訊，不是內容轉錄**：說明文字一律自行白話重寫（PRD §7.1）。
   */
  clause?: string;
  /** 版本年。同一部法規改過好幾次，讀者要知道我們看的是哪一版。 */
  year?: number;
  /**
   * 全文網址。**只有法規類會有**（全國法規資料庫全文免費公開）——
   * 公會規範是別人的著作，永遠不連、也不 host（spec 的「符號頁」）。
   */
  url?: string;
  /**
   * 轉載出處：經由這份文件讀到上面那份標準，而未核對標準原文（CONTEXT.md「轉載」）。
   * 有它就必須印出來，否則讀者會以為我們真的翻過標準原文（PRD §7.2.2）。
   */
  via?: string;
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

/**
 * 符號頁與分類頁要的形狀：說明卡那一份，再加它們自己要的欄位。
 *
 * 為什麼不是同一份：說明卡那一份會被序列化進**每一張平面圖頁**的 props，多一個欄位
 * 就是 14 筆乘以每張圖；符號頁是 server component，直接渲染成 HTML，多帶幾個欄位
 * 沒有人要付運費。兩個消費者的形狀因此由「它要不要過網路」決定，而不是由資料檔決定。
 */
export type SymbolPageRecord = SymbolRecord & {
  /** `data/symbols.sprite.svg` 裡的 `<symbol id>`。符號頁的圖形取自那裡，不另外畫一套（PRD §12）。 */
  svg_ref: string;
  /**
   * 完整出處。**只有符號頁印它**：說明卡上只給結論（`SOURCE_TIER_BADGES.note`），
   * 站在接待中心的人無從點開查證；坐下來讀落地頁的人才是來判斷「要不要信」的。
   */
  source_refs: SourceRef[];
  /**
   * 這個符號的頁面該把讀者帶去哪幾張格局圖——**編輯決定，不是統計**（CONTEXT.md「related_layouts」）。
   * 符號頁底部的轉換點由它決定去處（M3 票 08）。所以樑也有值：它在圖上沒有熱區，而我們就是要帶他去看那張看不到樑的圖。
   * 每個 id 都對得到實際存在的格局，由 `scripts/validate_data.py` 在建置前擋。
   */
  related_layouts: string[];
};

/**
 * 搜尋索引的一筆：比對要的 `name` 與 `aliases`，列出結果要的 `id` 與 `category`，**就這四欄**。
 *
 * 它是 client 元件的 props，會被序列化進每一張放搜尋框的頁面，所以與說明卡那一份同一個道理：
 * 多一欄就是 14 筆乘以每一頁。查證欄位（`source_refs`、`verification_status`⋯）尤其不得夾帶。
 * M4 的找找看也要從同一份出題，所以它不是搜尋框的私有形狀。
 */
export type SearchIndexEntry = {
  id: string;
  name: string;
  /** 同義詞、俗稱、英文——正式名稱以外，人們真的會打的字（PRD §6.2）。 */
  aliases: string[];
  category: SymbolCategory;
};
