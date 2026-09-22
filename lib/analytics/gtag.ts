export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

export const isValidGaMeasurementId = (id: string) => /^G-[A-Z0-9]+$/.test(id);

export const analyticsEnabledFor = (id: string | undefined | null) =>
  typeof id === "string" && isValidGaMeasurementId(id);

export const analyticsEnabled = analyticsEnabledFor(GA_MEASUREMENT_ID);

export type SymbolViewSource = "layout" | "search" | "quiz" | "category";

type SymbolPageView = {
  symbol_id: string;
  source: "search" | "category";
};

type LayoutSymbolView = {
  symbol_id: string;
  source: "layout" | "quiz";
  layout_id: string;
  hotspot_id: string;
};

export type SymbolViewEvent = SymbolPageView | LayoutSymbolView;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: "event", eventName: "symbol_view", params: SymbolViewEvent) => void;
  }
}

export function recordSymbolView(event: SymbolViewEvent) {
  if (!analyticsEnabled || typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "symbol_view", event);
}
