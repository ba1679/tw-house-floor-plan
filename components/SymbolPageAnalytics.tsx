"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordSymbolView, type SymbolViewSource } from "@/lib/analytics/gtag";

function sourceFromQuery(value: string | null): Extract<SymbolViewSource, "search" | "category"> {
  return value === "category" ? "category" : "search";
}

export function SymbolPageAnalytics({ symbolId }: { symbolId: string }) {
  const searchParams = useSearchParams();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    recordSymbolView({
      symbol_id: symbolId,
      source: sourceFromQuery(searchParams.get("from")),
    });
  }, [searchParams, symbolId]);

  return null;
}

