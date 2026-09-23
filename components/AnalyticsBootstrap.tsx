"use client";

import { useEffect } from "react";
import { initializeAnalytics } from "@/lib/analytics";

/** Loads GA whenever this Taiwan deployment has a configured measurement ID. */
export function AnalyticsBootstrap() {
  useEffect(() => initializeAnalytics(), []);
  return null;
}
