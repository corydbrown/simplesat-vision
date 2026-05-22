"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Inbox,
  MessageCircleMore,
  Search,
  UserSquare2,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/shared/avatar";
import { fullPagePath } from "@/components/shared/global-drawer";
import { colorFromName, initialsFromName } from "@/lib/color-from-name";
import { STATIC_INDEX, type SearchEntry } from "@/lib/search-index";
import {
  useRecentPages,
  type RecentEntityEntry,
} from "@/lib/recent-pages";
import type { SearchResponse, SearchResult } from "@/lib/search-types";
import { useViews } from "@/lib/views/provider";
import {
  ALL_VIEW_LABEL,
  ENTITY_BASE_PATH,
  NAV_SECTION_ORDER,
} from "@/lib/views/seed";
import {
  ALL_VIEW_ID,
  ENTITY_KEYS,
  type EntityKey,
} from "@/lib/views/types";
import { viewHref } from "@/lib/views/url";

const STATIC_INDEX_BY_HREF = new Map(STATIC_INDEX.map((e) => [e.href, e]));

// Entity types for which the palette renders a per-entity icon (avatars
// for people, lucide glyphs otherwise). Shared between Recent rows and
// dynamic search rows so they stay visually consistent.
type IconEntity = "customer" | "team-member" | "ticket" | "response" | "survey";

const DYNAMIC_GROUP_ENTITY: Record<string, IconEntity> = {
  Customers: "customer",
  Tickets: "ticket",
  Surveys: "survey",
  "Team members": "team-member",
  Responses: "response",
};

// Per-entity metadata for the dynamic "Views" group. Icon + iconClass mirror
// the sidebar section so a Detractors-on-Responses entry reads the same in the
// palette as in the nav. Label is the secondary text ("Detractors — Responses").
const VIEW_ENTITY_META: Record<
  EntityKey,
  { icon: LucideIcon; iconClass: string; label: string; basePath: string }
> = {
  responses: {
    icon: MessageCircleMore,
    iconClass: "text-icon-responses",
    label: "Responses",
    basePath: ENTITY_BASE_PATH.responses,
  },
  customers: {
    icon: UserSquare2,
    iconClass: "text-icon-customers",
    label: "Customers",
    basePath: ENTITY_BASE_PATH.customers,
  },
  "team-members": {
    icon: Users,
    iconClass: "text-icon-team-members",
    label: "Team members",
    basePath: ENTITY_BASE_PATH["team-members"],
  },
  tickets: {
    icon: Inbox,
    iconClass: "text-icon-tickets",
    label: "Tickets",
    basePath: ENTITY_BASE_PATH.tickets,
  },
};

type ViewEntry = {
  key: string;
  label: string;
  secondary: string;
  href: string;
  entity: EntityKey;
};

const GROUP_HEADING_CLS =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground/70";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_DYNAMIC: SearchResponse = {
  customers: [],
  tickets: [],
  surveys: [],
  teamMembers: [],
  responses: [],
};

export function SearchPalette({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dynamic, setDynamic] = useState<SearchResponse>(EMPTY_DYNAMIC);
  const [loading, setLoading] = useState(false);
  const recent = useRecentPages();
  const { views: viewsByEntity } = useViews();

  // Reset query when the palette closes so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setDynamic(EMPTY_DYNAMIC);
    }
  }, [open]);

  // Debounced fetch of dynamic entities from /api/search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDynamic(EMPTY_DYNAMIC);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`search failed: ${res.status}`);
        const data: SearchResponse = await res.json();
        setDynamic(data);
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          console.error("search fetch failed", err);
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const grouped = useMemo(() => groupStatic(STATIC_INDEX), []);

  // Views group: "All ENTITY" entries pinned to the head (in nav order), then
  // user-defined views sorted alphabetically across entities. SVP-33 will swap
  // alphabetical for `position` once view reordering lands.
  const viewEntries = useMemo<ViewEntry[]>(() => {
    const entries: ViewEntry[] = [];
    for (const entity of NAV_SECTION_ORDER) {
      const meta = VIEW_ENTITY_META[entity];
      entries.push({
        key: `view:${entity}:${ALL_VIEW_ID}`,
        label: ALL_VIEW_LABEL[entity],
        secondary: meta.label,
        href: meta.basePath,
        entity,
      });
    }
    const saved: { entity: EntityKey; id: string; name: string; href: string }[] = [];
    for (const entity of ENTITY_KEYS) {
      const meta = VIEW_ENTITY_META[entity];
      for (const v of viewsByEntity[entity]) {
        saved.push({
          entity,
          id: v.id,
          name: v.name,
          href: viewHref(meta.basePath, v.id, v.state),
        });
      }
    }
    saved.sort((a, b) => a.name.localeCompare(b.name));
    for (const v of saved) {
      entries.push({
        key: `view:${v.entity}:${v.id}`,
        label: v.name,
        secondary: VIEW_ENTITY_META[v.entity].label,
        href: v.href,
        entity: v.entity,
      });
    }
    return entries;
  }, [viewsByEntity]);

  const hasDynamic =
    dynamic.customers.length > 0 ||
    dynamic.tickets.length > 0 ||
    dynamic.surveys.length > 0 ||
    dynamic.teamMembers.length > 0 ||
    dynamic.responses.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 sm:max-w-xl overflow-hidden"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command
          label="Global search"
          className="flex min-w-0 flex-col max-h-[60vh]"
          // shouldFilter is true by default; cmdk fuzzy-matches the `value`
          // and `keywords` of each item against the input.
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <Search size={15} className="shrink-0 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, customers, tickets…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70"
              autoFocus
            />
            {loading ? (
              <span className="text-xs text-muted-foreground">…</span>
            ) : null}
          </div>

          <Command.List className="flex-1 overflow-y-auto py-1.5">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results
            </Command.Empty>

            {query.trim().length < 1 && recent.length > 0 ? (
              <Command.Group
                heading="Recent pages"
                className={GROUP_HEADING_CLS}
              >
                {recent.slice(0, 8).map((r) => {
                  if (r.kind === "entity") {
                    return (
                      <PaletteItem
                        key={`recent:entity:${r.entity}:${r.id}`}
                        value={`recent:entity:${r.entity}:${r.id}`}
                        label={r.label}
                        secondary={r.secondary}
                        icon={<EntityIcon entity={r.entity} entry={r} />}
                        onSelect={() => go(fullPagePath(r.entity, r.id))}
                      />
                    );
                  }
                  const indexed = STATIC_INDEX_BY_HREF.get(r.href);
                  if (!indexed) return null;
                  return (
                    <PaletteItem
                      key={`recent:page:${r.href}`}
                      value={`recent:page:${r.href}`}
                      label={indexed.label}
                      secondary={indexed.secondary}
                      icon={
                        indexed.icon ? <indexed.icon size={14} /> : null
                      }
                      onSelect={() => go(indexed.href)}
                    />
                  );
                })}
              </Command.Group>
            ) : null}

            {grouped.map(({ category, entries }) => (
              <Command.Group
                key={category}
                heading={category}
                className={GROUP_HEADING_CLS}
              >
                {entries.map((e) => (
                  <PaletteItem
                    key={e.id}
                    value={`${e.label} ${e.secondary ?? ""} ${(e.keywords ?? []).join(" ")}`.trim()}
                    label={e.label}
                    secondary={e.secondary}
                    icon={e.icon ? <e.icon size={14} /> : null}
                    onSelect={() => go(e.href)}
                  />
                ))}
              </Command.Group>
            ))}

            {viewEntries.length > 0 ? (
              <Command.Group heading="Views" className={GROUP_HEADING_CLS}>
                {viewEntries.map((v) => {
                  const meta = VIEW_ENTITY_META[v.entity];
                  const Icon = meta.icon;
                  return (
                    <PaletteItem
                      key={v.key}
                      value={`${v.label} ${v.secondary}`.trim()}
                      label={v.label}
                      secondary={v.secondary}
                      icon={
                        <Icon size={14} className={meta.iconClass} />
                      }
                      onSelect={() => go(v.href)}
                    />
                  );
                })}
              </Command.Group>
            ) : null}

            {hasDynamic ? (
              <>
                <DynamicGroup
                  heading="Customers"
                  results={dynamic.customers}
                  onSelect={go}
                />
                <DynamicGroup
                  heading="Tickets"
                  results={dynamic.tickets}
                  onSelect={go}
                />
                <DynamicGroup
                  heading="Surveys"
                  results={dynamic.surveys}
                  onSelect={go}
                />
                <DynamicGroup
                  heading="Team members"
                  results={dynamic.teamMembers}
                  onSelect={go}
                />
                <DynamicGroup
                  heading="Responses"
                  results={dynamic.responses}
                  onSelect={go}
                />
              </>
            ) : null}
          </Command.List>

          <div className="grid grid-cols-3 items-center border-t border-border px-3 py-1.5 text-xs text-muted-foreground/80">
            <span>↑↓ navigate</span>
            <span className="justify-self-center">↵ open</span>
            <span className="justify-self-end">esc close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function groupStatic(
  entries: SearchEntry[],
): { category: SearchEntry["category"]; entries: SearchEntry[] }[] {
  const order: SearchEntry["category"][] = ["Pages"];
  const map = new Map<SearchEntry["category"], SearchEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.category) ?? [];
    arr.push(e);
    map.set(e.category, arr);
  }
  return order
    .filter((c) => map.has(c))
    .map((c) => ({ category: c, entries: map.get(c)! }));
}

function DynamicGroup({
  heading,
  results,
  onSelect,
}: {
  heading: string;
  results: SearchResult[];
  onSelect: (href: string) => void;
}) {
  if (results.length === 0) return null;
  const entity = DYNAMIC_GROUP_ENTITY[heading];
  return (
    <Command.Group heading={heading} className={GROUP_HEADING_CLS}>
      {results.map((r) => (
        <PaletteItem
          key={`${heading}:${r.id}`}
          value={`${r.label} ${r.secondary ?? ""}`.trim()}
          label={r.label}
          secondary={r.secondary}
          icon={
            entity ? (
              <EntityIcon
                entity={entity}
                entry={{ label: r.label, avatarColor: r.avatarColor }}
              />
            ) : null
          }
          onSelect={() => onSelect(r.href)}
        />
      ))}
    </Command.Group>
  );
}

function EntityIcon({
  entity,
  entry,
}: {
  entity: IconEntity;
  // Minimal shape so both RecentEntityEntry and SearchResult can pass in.
  entry: Pick<RecentEntityEntry, "label" | "avatarColor">;
}) {
  if (entity === "customer") {
    return (
      <Avatar
        bg={colorFromName(entry.label)}
        initials={initialsFromName(entry.label)}
        size="sm"
      />
    );
  }
  if (entity === "team-member") {
    return (
      <Avatar
        bg={entry.avatarColor ?? colorFromName(entry.label)}
        initials={initialsFromName(entry.label)}
        size="sm"
      />
    );
  }
  if (entity === "ticket") return <Inbox size={14} />;
  if (entity === "response") return <MessageCircleMore size={14} />;
  return <ClipboardList size={14} />;
}

function PaletteItem({
  value,
  label,
  secondary,
  icon,
  onSelect,
}: {
  value: string;
  label: string;
  secondary?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm rounded-none data-[selected=true]:bg-accent data-[selected=true]:text-foreground"
    >
      {icon ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </span>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-foreground/90">
        {label}
      </span>
      {secondary ? (
        <span className="max-w-[45%] shrink-0 truncate pl-2 text-xs text-muted-foreground/70">
          {secondary}
        </span>
      ) : null}
    </Command.Item>
  );
}
