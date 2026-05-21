"use client";

import { Link2, MoreVertical } from "lucide-react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { useModKey } from "@/lib/platform";
import { useDetailHotkeys } from "@/lib/use-detail-hotkeys";

function buildAbsoluteUrl(href: string): string {
  if (typeof window === "undefined") return href;
  if (href.startsWith("http")) return href;
  return `${window.location.origin}${href}`;
}

export function DetailActions({ entityHref }: { entityHref: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const mod = useModKey();

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildAbsoluteUrl(entityHref));
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  // Cmd+L works anywhere DetailActions is mounted: standalone topbar,
  // drawer header, future detail surfaces. preventDefault overrides the
  // browser's address-bar shortcut (Notion convention).
  useDetailHotkeys({ onCopyLink: copy });

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip open={copied || undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Copy link"
            onClick={copy}
            className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Link2 size={15} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {copied ? (
            "Copied"
          ) : (
            <>
              Copy link <Kbd>{mod}</Kbd>
              <Kbd>L</Kbd>
            </>
          )}
        </TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Actions"
                className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreVertical size={16} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem disabled>Edit</DropdownMenuItem>
          <DropdownMenuItem disabled>Duplicate</DropdownMenuItem>
          <DropdownMenuItem disabled>Archive</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="text-destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
