"use client";

import { useEffect, useRef } from "react";
import { track, type SymbolViewEvent } from "@/lib/analytics";

/** Emits once per mounted readable-symbol surface, including Strict Mode. */
export function TrackSymbolView({ event }: { event: SymbolViewEvent }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event);
  }, [event]);
  return null;
}
