"use client";

import { useState } from "react";
import { Check, ChevronDown, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupHeading } from "@/components/shared/group-heading";
import type { WorkspaceSummary } from "@/db/queries/workspaces";
import { setActiveWorkspace } from "@/lib/workspaces/actions";

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: WorkspaceSummary[];
  activeId: string | null;
}) {
  const active =
    workspaces.find((w) => w.id === activeId) ?? workspaces[0] ?? null;

  // No memberships — bail out rather than rendering an empty switcher. Reached
  // only if /callback's auto-grant failed, which already throws at
  // requireWorkspace() the moment the user loads any list page.
  if (!active) return null;

  // Single-workspace user: render the trigger shape as a static label. No
  // dropdown — the only meaningful action is the Settings link, which lives
  // on the user pill / settings page anyway.
  if (workspaces.length <= 1) {
    return (
      <div
        className="-mx-1 flex min-w-0 items-center gap-2 rounded px-1 py-0.5"
        aria-label={`Workspace: ${active.name}`}
      >
        <WorkspaceAvatar name={active.name} logoUrl={active.logoUrl} />
        <span className="truncate font-medium text-foreground">
          {active.name}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="-mx-1 flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-accent/60 data-[state=open]:bg-accent/60"
        >
          <WorkspaceAvatar name={active.name} logoUrl={active.logoUrl} />
          <span className="truncate font-medium text-foreground">
            {active.name}
          </span>
          <ChevronDown
            size={13}
            className="shrink-0 text-muted-foreground/70"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <GroupHeading className="font-normal">Switch workspace</GroupHeading>
        {workspaces.map((w) => {
          const isActive = w.id === active.id;
          return (
            <form key={w.id} action={setActiveWorkspace.bind(null, w.id)}>
              <DropdownMenuItem
                asChild
                // Don't let Radix close-on-select cancel the form submit
                // before the server action runs.
                onSelect={(e) => e.preventDefault()}
              >
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-2"
                >
                  <WorkspaceAvatar name={w.name} logoUrl={w.logoUrl} />
                  <span className="min-w-0 flex-1 truncate text-left">
                    {w.name}
                  </span>
                  {isActive ? (
                    <Check size={14} className="shrink-0" />
                  ) : (
                    <span aria-hidden className="w-3.5 shrink-0" />
                  )}
                </button>
              </DropdownMenuItem>
            </form>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/workspace" className="cursor-pointer">
            <Settings size={14} className="text-muted-foreground" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceAvatar({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  // Track image-load failures so a broken Brandfetch URL (CDN took down the
  // brand, network glitch on first paint) silently falls back to the initial
  // glyph instead of rendering a broken-image icon in the sidebar.
  const [errored, setErrored] = useState(false);

  if (logoUrl && !errored) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={24}
        height={24}
        unoptimized
        aria-hidden
        className="h-6 w-6 shrink-0 rounded bg-background object-contain ring-1 ring-foreground/10"
        onError={() => setErrored(true)}
      />
    );
  }

  // `!text-background` defends against the dropdown item's
  // `focus:**:text-accent-foreground` cascade, which would otherwise drop the
  // letter to the same color as the avatar background on hover and erase the
  // glyph.
  return (
    <div
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-foreground text-base font-semibold !text-background"
    >
      {initial(name)}
    </div>
  );
}
