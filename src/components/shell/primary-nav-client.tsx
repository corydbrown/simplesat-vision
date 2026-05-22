"use client";

import {
  BarChart3,
  ChevronDown,
  Home,
  Inbox,
  MessageCircleMore,
  Search,
  Settings,
  UserSquare2,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useSidebar,
} from "./sidebar-context";
import { useSearch } from "./search-context";
import { useModKey } from "@/lib/platform";
import { useEntityViews } from "@/lib/views/provider";
import { ALL_VIEW_LABEL, ENTITY_BASE_PATH } from "@/lib/views/seed";
import { ALL_VIEW_ID, type EntityKey } from "@/lib/views/types";
import { VIEW_ID_PARAM, viewHref } from "@/lib/views/url";

export type NavView = {
  id: string;
  label: string;
  href: string;
};

export type NavSection = {
  id: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Tailwind text color utility for the icon, e.g. `text-icon-responses`. Token in globals.css. */
  iconClass?: string;
  href: string;
  /** When set, the section's view list is sourced from ViewsProvider for
   *  the named entity. The hardcoded "All ENTITY" view is materialized
   *  client-side and always pinned first. */
  entityKey?: EntityKey;
  /** Static view list, used for sections without an entity binding (Reports). */
  views?: NavView[];
};

const ICONS = {
  Inbox,
  MessageCircleMore,
  UserSquare2,
  Users,
  BarChart3,
} satisfies Record<string, LucideIcon>;

// Stores the set of *expanded* section ids so an empty/missing value collapses
// everything by default. Old `simplesat:nav:collapsed` key (set of collapsed
// ids) had the opposite semantics and is intentionally not migrated.
const EXPANDED_KEY = "simplesat:nav:expanded";

function loadExpanded(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveExpanded(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPANDED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export function PrimaryNavClient({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { width, collapsed, setWidth } = useSidebar();
  const { open: openSearch } = useSearch();
  const mod = useModKey();
  const [resizing, setResizing] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSectionsExpanded(loadExpanded());
  }, []);

  function toggleSection(id: string) {
    setSectionsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveExpanded(next);
      return next;
    });
  }

  // Drag-to-resize the sidebar by its right edge. While resizing, the
  // width transition is suppressed so the drag feels 1:1.
  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: PointerEvent) => {
        setWidth(startW + (ev.clientX - startX));
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
      };
      document.body.style.cursor = "col-resize";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [width, setWidth],
  );

  return (
    <nav
      style={{
        width: collapsed ? 0 : width,
        transition: resizing ? "none" : "width 200ms ease-out",
      }}
      aria-hidden={collapsed}
      className="relative shrink-0 overflow-hidden border-r border-border bg-sidebar sticky top-0 h-screen text-base"
    >
      <div
        style={{ width }}
        className="flex h-full flex-col px-2 py-3"
      >
        <div className="flex items-center gap-2 px-2 pb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-background text-base font-semibold">
            B
          </div>
          <span className="font-medium text-foreground">Bloom Beauty</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search"
                className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <Search size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Search <Kbd>{mod}</Kbd>
              <Kbd>K</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col gap-0.5">
          <TopLink
            href="/"
            icon={Home}
            label="Home"
            pathname={pathname}
            match="/"
          />
          <TopLink
            href="/inbox"
            icon={Inbox}
            label="Inbox"
            pathname={pathname}
            match="/inbox"
            dim
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {sections.map((s) => (
            <Section
              key={s.id}
              section={s}
              pathname={pathname}
              currentViewId={searchParams.get(VIEW_ID_PARAM) ?? ALL_VIEW_ID}
              isCollapsed={!sectionsExpanded.has(s.id)}
              onToggle={() => toggleSection(s.id)}
            />
          ))}
        </div>

        <div className="flex-1" />
        <TopLink
          href="/settings"
          icon={Settings}
          label="Settings"
          pathname={pathname}
          match="/settings"
          dim
        />
      </div>

      {/* Drag handle on right edge — wider than visible for easier grab.
          Hidden while the sidebar is collapsed so it doesn't float in the
          content area. */}
      {!collapsed && (
        <div
          onPointerDown={onResizeStart}
          role="separator"
          aria-label="Resize sidebar"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={width}
          className="absolute right-0 top-0 bottom-0 w-1.5 translate-x-1/2 cursor-col-resize hover:bg-border/80"
        />
      )}
    </nav>
  );
}

function TopLink({
  href,
  icon: Icon,
  label,
  pathname,
  match,
  dim,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  pathname: string;
  match: string;
  dim?: boolean;
}) {
  const active = match === "/" ? pathname === "/" : pathname.startsWith(match);
  return (
    <Link
      href={href}
      className={`flex h-7 cursor-pointer items-center gap-2 rounded px-2 transition-colors ${
        active
          ? "bg-accent text-foreground font-medium"
          : dim
            ? "text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground"
            : "text-foreground/80 hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
    </Link>
  );
}

// Notion-style section. The whole row is one hoverable, clickable button
// that toggles collapse. Chevron appears next to the label on hover; the
// right edge of the row is reserved for future per-section actions.

function Section({
  section,
  pathname,
  currentViewId,
  isCollapsed,
  onToggle,
}: {
  section: NavSection;
  pathname: string;
  currentViewId: string;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = ICONS[section.icon];
  const inSection = pathname.startsWith(section.href);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        className="group flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-left text-base font-medium text-muted-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <Icon size={14} className={`shrink-0 ${section.iconClass ?? ""}`} />
        <span className="truncate">{section.label}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted-foreground/70 opacity-0 transition-all group-hover:opacity-100 ${
            isCollapsed ? "-rotate-90" : ""
          }`}
        />
      </button>
      {!isCollapsed && section.entityKey && (
        <EntityViewList
          entityKey={section.entityKey}
          inSection={inSection}
          currentViewId={currentViewId}
        />
      )}
      {!isCollapsed &&
        !section.entityKey &&
        section.views &&
        section.views.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {section.views.map((v) => (
              <ViewLink
                key={v.id}
                view={v}
                active={inSection && currentViewId === v.id}
              />
            ))}
          </div>
        )}
    </div>
  );
}

function EntityViewList({
  entityKey,
  inSection,
  currentViewId,
}: {
  entityKey: EntityKey;
  inSection: boolean;
  currentViewId: string;
}) {
  const saved = useEntityViews(entityKey);
  const basePath = ENTITY_BASE_PATH[entityKey];
  const allLabel = ALL_VIEW_LABEL[entityKey];

  const views: NavView[] = useMemo(() => {
    const sorted = [...saved].sort((a, b) => a.name.localeCompare(b.name));
    return [
      { id: ALL_VIEW_ID, label: allLabel, href: basePath },
      ...sorted.map((v) => ({
        id: v.id,
        label: v.name,
        href: viewHref(basePath, v.id, v.state),
      })),
    ];
  }, [saved, basePath, allLabel]);

  return (
    <div className="flex flex-col gap-0.5">
      {views.map((v) => (
        <ViewLink
          key={v.id}
          view={v}
          active={inSection && currentViewId === v.id}
        />
      ))}
    </div>
  );
}

function ViewLink({ view, active }: { view: NavView; active: boolean }) {
  return (
    <Link
      href={view.href}
      className={`flex h-7 cursor-pointer items-center rounded px-2 transition-colors ${
        active
          ? "bg-accent text-foreground font-medium"
          : "text-foreground/75 hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <span className="truncate">{view.label}</span>
    </Link>
  );
}
