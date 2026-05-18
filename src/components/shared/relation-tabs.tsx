"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type Tab = {
  id: string;
  label: string;
  count?: number | string;
};

export function RelationTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("tab") ?? tabs[0]?.id;

  function buildHref(tabId: string): string {
    const next = new URLSearchParams(searchParams.toString());
    if (tabId === tabs[0]?.id) {
      next.delete("tab");
    } else {
      next.set("tab", tabId);
    }
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center gap-1 border-b border-border">
      {tabs.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={buildHref(t.id)}
            scroll={false}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
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
  );
}
