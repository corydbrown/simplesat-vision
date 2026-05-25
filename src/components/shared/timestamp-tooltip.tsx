"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatAbsolute } from "@/lib/format";

// Wraps a relative-time display (e.g. `formatRelative`, `formatSmartTime`,
// `formatTimelineDay`) with a hover tooltip showing the absolute date+time.
// Pass the trigger element as the only child — it becomes the hover target
// via Radix's asChild slot, so callers keep their own styling/layout.
export function TimestampTooltip({
  date,
  children,
}: {
  date: Date | number | string | null | undefined;
  children: React.ReactNode;
}) {
  if (date == null) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{formatAbsolute(date)}</TooltipContent>
    </Tooltip>
  );
}
