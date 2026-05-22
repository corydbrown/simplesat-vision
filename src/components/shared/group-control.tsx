"use client";

import { ArrowDown, ArrowUp, Check, Group as GroupIcon, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { decodeGroup, encodeGroup } from "@/lib/group/url-state";
import type { GroupDir, GroupSpec } from "@/lib/group/types";
import type { Property } from "@/lib/properties/types";
import { cn } from "@/lib/utils";

export function GroupControl<T>({
  properties,
  paramPrefix = "",
}: {
  properties: Property<T>[];
  paramPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const groupable = useMemo(
    () => properties.filter((p) => p.groupable === true),
    [properties],
  );
  const allowedIds = useMemo(() => groupable.map((p) => p.id), [groupable]);

  const paramKey = `${paramPrefix}group`;
  const pageKey = `${paramPrefix}page`;
  const spec: GroupSpec | null = decodeGroup(
    searchParams.get(paramKey),
    allowedIds,
  );
  const selected = spec
    ? (groupable.find((p) => p.id === spec.propertyId) ?? null)
    : null;

  const writeUrl = useCallback(
    (next: GroupSpec | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set(paramKey, encodeGroup(next));
      } else {
        params.delete(paramKey);
      }
      // Group change resets pagination to page 1 (matches existing
      // sort/filter invariant on /tickets).
      params.delete(pageKey);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, paramKey, pageKey],
  );

  const setProperty = useCallback(
    (propertyId: string) => {
      const currentDir: GroupDir = spec?.dir ?? "asc";
      writeUrl({ propertyId, dir: currentDir });
    },
    [spec, writeUrl],
  );

  const toggleDir = useCallback(() => {
    if (!spec) return;
    writeUrl({ propertyId: spec.propertyId, dir: spec.dir === "asc" ? "desc" : "asc" });
  }, [spec, writeUrl]);

  const clear = useCallback(() => {
    writeUrl(null);
  }, [writeUrl]);

  // Hide entirely if there are no groupable properties on this surface.
  if (groupable.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 cursor-pointer gap-1.5 text-sm",
            selected
              ? "bg-blue-lighter text-blue-darker hover:bg-blue-lighter hover:text-blue-darker aria-expanded:bg-blue-lighter aria-expanded:text-blue-darker"
              : "text-muted-foreground data-[state=open]:bg-accent",
          )}
        >
          <GroupIcon size={13} />
          {selected ? <>Group by {selected.label}</> : "Group"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground/80">
          Group by
        </div>
        <div className="flex flex-col">
          {groupable.map((p) => {
            const active = spec?.propertyId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProperty(p.id)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <span>{p.label}</span>
                {active && <Check size={14} className="text-foreground" />}
              </button>
            );
          })}
        </div>
        {spec && (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              onClick={toggleDir}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            >
              {spec.dir === "asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              )}
              {spec.dir === "asc" ? "Ascending" : "Descending"}
            </button>
            <button
              type="button"
              onClick={clear}
              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
            >
              <X size={14} />
              Remove grouping
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
