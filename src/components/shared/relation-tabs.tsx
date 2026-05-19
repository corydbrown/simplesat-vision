"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type Tab = {
  id: string;
  label: string;
  count?: number | string;
};

export function RelationTabs({
  tabs,
  paramName = "tab",
  alwaysSet = false,
  trailing,
}: {
  tabs: Tab[];
  paramName?: string;
  /**
   * If true, the first/default tab still puts paramName in the URL.
   * Otherwise, the default tab clears the param.
   */
  alwaysSet?: boolean;
  /**
   * Slot for content rendered right-aligned next to the tabs.
   * Used for things like "open as full-width table" links.
   */
  trailing?: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? tabs[0]?.id;

  function buildHref(tabId: string): string {
    const next = new URLSearchParams(searchParams.toString());
    if (tabId === tabs[0]?.id && !alwaysSet) {
      next.delete(paramName);
    } else {
      next.set(paramName, tabId);
    }
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center gap-1 pb-2">
      <div className="flex flex-1 items-center gap-1 min-w-0">
      {tabs.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={buildHref(t.id)}
            scroll={false}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-accent text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
      </div>
      {trailing}
    </div>
  );
}
