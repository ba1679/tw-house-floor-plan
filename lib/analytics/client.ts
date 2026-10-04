"use client";

import type { AnalyticsEvent } from "./events";

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (command: "event" | "config" | "js", name: string | Date, params?: Record<string, unknown>) => void;
  /** Test-only. Browser tests install this before page scripts run. */
  __fpAnalyticsEvents?: AnalyticsEvent[];
};

const browser = (): AnalyticsWindow | null =>
  typeof window === "undefined" ? null : (window as AnalyticsWindow);

function measurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  return id || null;
}

/**
 * Starts GA when a measurement ID is configured. Test pages install the memory
 * sink before React runs, so they deliberately never load the external script.
 */
export function initializeAnalytics(): void {
  const target = browser();
  const id = measurementId();
  if (!target || !id || target.gtag || target.__fpAnalyticsEvents) return;

  target.dataLayer ??= [];
  target.gtag = function gtag(command, name, params) {
    target.dataLayer?.push(arguments);
  };
  target.gtag("js", new Date());
  target.gtag("config", id);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}

/**
 * The sole event gateway. The test sink deliberately receives the exact typed
 * event before GA's availability check; this makes tests deterministic and
 * avoids making any request to Google.
 */
export function track(event: AnalyticsEvent): void {
  const target = browser();
  if (!target) return;

  if (target.__fpAnalyticsEvents) {
    target.__fpAnalyticsEvents.push(event);
    return;
  }

  if (!measurementId() || !target.gtag) return;
  const { name, ...params } = event;
  target.gtag("event", name, params);
}
