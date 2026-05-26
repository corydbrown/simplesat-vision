"use client";

import {
  Check,
  ChevronDown,
  FlaskConical,
  Headphones,
  MessageCircle,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceSummary } from "@/db/queries/workspaces";
import type { WorkspaceIntegrationType } from "@/db/schema";
import { setActiveWorkspace } from "@/lib/workspaces/actions";

const INTEGRATION_ICON: Record<WorkspaceIntegrationType, LucideIcon> = {
  intercom: MessageCircle,
  zendesk: Headphones,
  mock: FlaskConical,
};

const INTEGRATION_LABEL: Record<WorkspaceIntegrationType, string> = {
  intercom: "Intercom",
  zendesk: "Zendesk",
  mock: "Demo data",
};

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

  const ActiveIcon = INTEGRATION_ICON[active.integrationType];

  // Single-workspace user: render the trigger shape as a static label. No
  // dropdown — the only meaningful action is the Settings link, which lives
  // on the user pill / settings page anyway.
  if (workspaces.length <= 1) {
    return (
      <div
        className="-mx-1 flex min-w-0 items-center gap-2 rounded px-1 py-0.5"
        aria-label={`Workspace: ${active.name}`}
      >
        <WorkspaceAvatar name={active.name} />
        <span className="truncate font-medium text-foreground">
          {active.name}
        </span>
        <ActiveIcon
          size={11}
          aria-hidden
          className="shrink-0 text-muted-foreground/60"
        />
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
          <WorkspaceAvatar name={active.name} />
          <span className="truncate font-medium text-foreground">
            {active.name}
          </span>
          <ActiveIcon
            size={11}
            aria-hidden
            className="shrink-0 text-muted-foreground/60"
          />
          <ChevronDown
            size={13}
            className="shrink-0 text-muted-foreground/70"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Switch workspace
        </DropdownMenuLabel>
        {workspaces.map((w) => {
          const Icon = INTEGRATION_ICON[w.integrationType];
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
                  <WorkspaceAvatar name={w.name} />
                  <span className="min-w-0 flex-1 truncate text-base text-foreground">
                    {w.name}
                  </span>
                  <Icon
                    size={12}
                    aria-label={INTEGRATION_LABEL[w.integrationType]}
                    className="shrink-0 text-muted-foreground/70"
                  />
                  {isActive ? (
                    <Check size={14} className="shrink-0 text-foreground" />
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
          <Link href="/settings" className="cursor-pointer">
            <Settings size={14} className="text-muted-foreground" />
            Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkspaceAvatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-foreground text-base font-semibold text-background"
    >
      {initial(name)}
    </div>
  );
}
