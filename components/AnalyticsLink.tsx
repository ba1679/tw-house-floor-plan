"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track, type SelectContentEvent } from "@/lib/analytics";

type Props = ComponentProps<typeof Link> & { event: SelectContentEvent };

/** A real Next link that records only one of the product's named entry points. */
export function AnalyticsLink({ event, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(click) => {
        onClick?.(click);
        if (!click.defaultPrevented) track(event);
      }}
    />
  );
}
