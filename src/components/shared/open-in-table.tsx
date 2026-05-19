"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Escape hatch from the in-detail relation tables to the full-width list
// page, optionally pre-filtered. Rendered as the `trailing` slot of
// RelationTabs.

export function OpenInTable({
  href,
  label = "Open as full table",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          aria-label={label}
          className="inline-flex cursor-pointer items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowUpRight size={14} />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
