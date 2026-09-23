"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SourceBadge } from "./SourceBadge";
import type { Occurrence } from "@/lib/viewer/interaction";
import type { SymbolRecord } from "@/lib/symbols/types";
import {
  CATEGORY_LABELS,
  DISCLAIMER,
  SHEET_CONTROLS,
  SECTION_LABELS,
  confusedWithLabel,
  occurrenceLabel,
  occurrenceTotalLabel,
} from "@/lib/ui/copy";
import styles from "./InfoSheet.module.css";

// PRD §10.1 分層裡的 Info Panel：使用者確認符號之後，這張卡告訴他這是什麼、
// 要注意什麼，**以及這個說法是從哪份文件來的**。
//
// 卡片是版面裡的一格，不是浮在圖上的一層——它升起來，圖就被擠進上方那條可視帶
// （票 03 決議 3）。浮層版本會把圖的下半（次臥、後陽台、主臥衛浴那一帶）壓在卡片底下，
// 「一邊看說明一邊知道它在圖上哪裡」在那半張圖就不成立。
//
// 卡片講哪個符號由呼叫端給（`symbol`）。自由看圖給的是選中的那一個；找找看答錯時給的是**題目符號**，
// 而被點中的是另一個（M4 票 02）——所以卡片自己不去問「選中了誰」。
//
// 畫面上的字全部來自 symbol 資料、lib/ui/copy.ts，或呼叫端交進來的 `note`，一字不散在這裡。

/**
 * 這個符號在這張圖上的出現次數，兩種形狀擇一（M4 票 02）：
 * - 自由看圖：共 N 處、現在看第 M 處，加上換看下一處的那一鍵。
 * - 找找看：只有共 N 處。每一處已經都標在圖上，而答錯時被點中的不是這個符號，「第 M 處」數不出來。
 *
 * 綁成一個值、而不是兩個選填欄位：「有第 M 處卻沒有切換鍵」這種組合就寫不出來。
 */
export type SheetOccurrence = (Occurrence & { onNext: () => void }) | Pick<Occurrence, "total">;

/**
 * 卡片最上面多出來的那一段，內容由呼叫端給：找找看答錯時的「你點的是 X」與差異句（M4 票 02）。
 * 卡片不必知道什麼是作答——它只負責把這一段排在最先讀到的位置。
 */
export type SheetNote = { lead: string; detail: string | null };

type Props = {
  symbol: SymbolRecord;
  /** 整份符號表。容易搞混區塊要顯示對方的名字，而 confused_with 裡只有 id。 */
  symbols: Record<string, SymbolRecord>;
  /** 由 floorplan 算出來，不得寫死。見 `SheetOccurrence`。 */
  occurrence: SheetOccurrence;
  note?: SheetNote;
  /**
   * 卡片開啟時把焦點收進來。鍵盤打開的卡片才給 true（票 06）：
   * 焦點留在圖上的話，Tab 的下一站是圖上的下一個熱區，卡片裡的內容永遠走不到。
   */
  takeFocus: boolean;
  /** Parent keeps the card mounted long enough for its structural exit transition. */
  closing?: boolean;
  onClose: () => void;
  /** The caller owns context-specific analytics; this component owns the UI seam. */
  onAction?: (action: "expand" | "collapse" | "close" | "next_occurrence") => void;
};

/** 圖上那個十字準星，兩種呈現共用。 */
function OccurrenceMark() {
  return (
    <svg className={styles.occurrenceMark} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function InfoSheet({
  symbol,
  symbols,
  occurrence,
  note,
  takeFocus,
  closing = false,
  onClose,
  onAction,
}: Props) {
  const sheetRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // 換一個符號就收回初始高度：上一個符號展開過，不代表這一個也需要展開。
  useEffect(() => setExpanded(false), [symbol.id]);

  // 焦點收進卡片本身，不是卡片裡的第一顆按鈕（那是關閉鍵——一開卡就停在「關掉我」上面，
  // 讀螢幕的人得先退回去才讀得到內容）。卡片有 aria-labelledby，落點就是那個符號的名字。
  useEffect(() => {
    if (takeFocus) sheetRef.current?.focus();
  }, [takeFocus]);

  // 內容有沒有超出上限，只有排版之後才知道——13/14 個符號沒有 caution，
  // 塞不塞得下因符號而異（票 03 決議 1）。塞得下就不該出現漸層與提示。
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [symbol.id, expanded]);

  const category = CATEGORY_LABELS[symbol.category];
  const toggleExpanded = useCallback(() => {
    if (expanded) {
      // Returning to the summary must show the reader the beginning again.
      if (bodyRef.current) bodyRef.current.scrollTop = 0;
      setExpanded(false);
      onAction?.("collapse");
      return;
    }
    setExpanded(true);
    onAction?.("expand");
  }, [expanded, onAction]);

  const close = useCallback(() => {
    onAction?.("close");
    onClose();
  }, [onAction, onClose]);

  const next = useCallback(() => {
    if ("onNext" in occurrence) {
      onAction?.("next_occurrence");
      occurrence.onNext();
    }
  }, [occurrence, onAction]);

  return (
    <aside
      id="info-sheet"
      ref={sheetRef}
      // 焦點的落點，但不進 Tab 序列：Tab 從卡片裡繼續往下走是關閉鍵、「其他位置」，
      // 而不是再回到卡片這個容器本身。
      tabIndex={-1}
      className={styles.sheet}
      data-expanded={expanded ? "true" : "false"}
      data-closing={closing ? "true" : "false"}
      aria-labelledby="info-sheet-name"
    >
      {/* 標題列不捲動：關閉鍵必須隨時按得到。 */}
      <header className={styles.header}>
        <div className={styles.identity}>
          <h2 id="info-sheet-name" className={styles.name}>
            {symbol.name}
          </h2>
          <p className={styles.category}>
            {category.zh} / {category.en}
          </p>
        </div>
        {/* 關卡片之後發生什麼是呼叫端的事：自由看圖是「重選」（回到 browsing 並還原視野，票 03），
            找找看只是把卡片收起來，標記與暫停都留著（M4 票 02）。 */}
        <button
          type="button"
          className={styles.close}
          onClick={close}
          disabled={closing}
          aria-label={SHEET_CONTROLS.close}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className={styles.bodyWrap}>
        <div id="info-sheet-body" className={styles.body} ref={bodyRef}>
          {/* 排在最前面、跟著內容捲：它是這張卡此刻為什麼打開的理由，但不該佔住不捲的標題列——
              差異句可能有三行，而卡片的高度上限是 46dvh。 */}
          {note && (
            <section className={styles.note} data-section="note">
              <p className={styles.noteLead}>{note.lead}</p>
              {note.detail && <p className={styles.noteDetail}>{note.detail}</p>}
            </section>
          )}

          <div className={styles.badgeRow}>
            {/* source_tier 與 verification_status 是兩條不同的軸（CONTEXT.md）：
                這裡呈現的是「答案從哪來」，「我們查證做到哪」不上前台。 */}
            <SourceBadge tier={symbol.source_tier} />
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>{SECTION_LABELS.plainMeaning}</h3>
            <p className={styles.prose}>{symbol.plain_meaning}</p>
          </section>

          {/* caution 為 null 時整個區塊不出現，不留標題也不留空白——
              14 個符號裡只有雨遮有，留一個空標題會讓另外 13 張卡看起來像壞掉。 */}
          {symbol.caution && (
            <section className={styles.section} data-section="caution">
              <h3 className={styles.sectionLabel}>{SECTION_LABELS.caution}</h3>
              <p className={styles.prose}>{symbol.caution}</p>
            </section>
          )}

          {symbol.confused_with.length > 0 && (
            <section className={styles.section} data-section="confused-with">
              <h3 className={styles.sectionLabel}>{SECTION_LABELS.confusedWith}</h3>
              <dl className={styles.confusedList}>
                {symbol.confused_with.map((other) => (
                  <div key={other.symbol_id} className={styles.confusedItem}>
                    <dt className={styles.confusedName}>
                      {confusedWithLabel(symbols[other.symbol_id]?.name ?? other.symbol_id)}
                    </dt>
                    <dd className={styles.confusedText}>{other.difference}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {/* 展開的觸發是**點一下**，不是拖曳——拖曳手勢會跟票 04 的 pan/zoom 打架。 */}
        {(overflowing || expanded) && (
          <button
            type="button"
            className={styles.expand}
            onClick={toggleExpanded}
            disabled={closing}
            aria-expanded={expanded}
            aria-controls="info-sheet-body"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={expanded ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6"} />
            </svg>
            {expanded ? SHEET_CONTROLS.collapse : SHEET_CONTROLS.expand}
          </button>
        )}
      </div>

      {/* N 為 1 時**整列**不出現（決議 2）：只有一處的符號沒有「其他位置」可去。
          代價是「共 1 處」這個事實也跟著不見——那是 spec user story 17 想說的話。
          2026-09-07 裁定維持現狀：這一列量起來約 43px，而卡片離 46vh 的上限只剩 14px，
          補回去就 14/14 全部頂到上限，決議 1 的「高度隨內容走」在這張圖上再也沒有例子。
          不必再回頭翻這個問題，來龍去脈在票 03 的 comments。
          找找看那一列（只有「共 N 處」）同一條規矩：2026-09-14 規格主人裁定照決議 2（M4 票 02 的 Comments）。 */}
      {occurrence.total > 1 &&
        ("onNext" in occurrence ? (
          <button type="button" className={styles.occurrences} onClick={next} disabled={closing}>
            <OccurrenceMark />
            <span className={styles.occurrenceText}>
              <span className={styles.occurrenceTitle}>{SHEET_CONTROLS.otherOccurrences}</span>
              <span className={styles.occurrenceCount}>
                {occurrenceLabel(occurrence.total, occurrence.index)}
              </span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <p className={styles.occurrenceTotal}>
            <OccurrenceMark />
            <span className={styles.occurrenceCount}>{occurrenceTotalLabel(occurrence.total)}</span>
          </p>
        ))}

      {/* 免責固定在最底，不隨捲動消失（PRD §6.4）。 */}
      <p className={styles.disclaimer}>{DISCLAIMER}</p>
    </aside>
  );
}
