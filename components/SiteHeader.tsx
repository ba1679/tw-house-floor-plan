"use client";

import Link from "next/link";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { SITE_NAME } from "@/lib/ui/copy";
import styles from "./SiteHeader.module.css";

function originPageType(): "home" | "category" | "symbol" | "layout" | "quiz" {
  const path = window.location.pathname;
  if (path.includes("/quiz")) return "quiz";
  if (path.startsWith("/layouts/")) return "layout";
  if (path.startsWith("/symbols/")) return "symbol";
  if (path.startsWith("/categories/")) return "category";
  return "home";
}

/** A small plan-line mark: a floor-plan cue, intentionally not a house icon. */
function PlanMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M4 5h24v22H4zM4 15h12M16 5v10M16 15h12M11 15v12M16 20h5" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Link
        className={styles.home}
        href="/"
        aria-label={`回首頁：${SITE_NAME}`}
        onClick={() =>
          track({
            name: ANALYTICS_EVENTS.selectContent,
            content_type: "header_home",
            item_id: "home",
            origin_page_type: originPageType(),
          })
        }
      >
        <PlanMark />
        <span className={styles.name}>{SITE_NAME}</span>
      </Link>
    </header>
  );
}
