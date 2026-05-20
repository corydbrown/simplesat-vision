"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATIC_INDEX, type SearchEntry } from "@/lib/search-index";
import type { SearchResponse, SearchResult } from "@/lib/search-types";

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

            {grouped.map(({ category, entries }) => (
              <Command.Group
                key={category}
                heading={category}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground/70"
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

          <div className="grid grid-cols-3 items-center border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground/80">
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
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground/70"
    >
      {results.map((r) => (
        <PaletteItem
          key={`${heading}:${r.id}`}
          value={`${r.label} ${r.secondary ?? ""}`.trim()}
          label={r.label}
          secondary={r.secondary}
          onSelect={() => onSelect(r.href)}
        />
      ))}
    </Command.Group>
  );
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
      ) : null}
      <span className="min-w-0 flex-1 truncate text-foreground/90">
        {label}
      </span>
      {secondary ? (
        <span
          className="shrink-0 truncate pl-2 text-xs text-muted-foreground/70"
          style={{ maxWidth: "45%" }}
        >
          {secondary}
        </span>
      ) : null}
    </Command.Item>
  );
}
