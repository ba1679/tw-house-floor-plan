"use client";

import Link from "next/link";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics";
import { SITE_NAME, SITE_ROMANIZATION } from "@/lib/ui/copy";
import { BrandMark } from "./BrandMark";
import styles from "./SiteHeader.module.css";

function originPageType(): "home" | "category" | "symbol" | "layout" | "quiz" {
  const path = window.location.pathname;
  if (path.includes("/quiz")) return "quiz";
  if (path.startsWith("/layouts/")) return "layout";
  if (path.startsWith("/symbols/")) return "symbol";
  if (path.startsWith("/categories/")) return "category";
  return "home";
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
        <BrandMark variant="compact" className={styles.mark} />
        <span className={styles.wordmark}>
          <span className={styles.name}>{SITE_NAME}</span>
          <span className={styles.romanization}>{SITE_ROMANIZATION}</span>
        </span>
      </Link>
    </header>
  );
}
