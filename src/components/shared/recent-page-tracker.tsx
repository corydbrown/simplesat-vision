"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { STATIC_INDEX } from "@/lib/search-index";
import { recordPageView } from "@/lib/recent-pages";

// Only params that change which canonical page you're on (per STATIC_INDEX)
// participate in dedupe. Drawer / per-table state (`drawer`, `dt`, `dsort`,
// `ddir`, `dpage`, `sort`, `dir`, `page`, …) is stripped so revisiting the
// same view with a drawer open doesn't churn a new recents entry.
const PAGE_OWNED_PARAMS = ["view"];

const HREF_SET = new Set(STATIC_INDEX.map((e) => e.href));

function normalizeHref(
  pathname: string,
  params: ReadonlyURLSearchParams,
): string {
  const next = new URLSearchParams();
  for (const k of PAGE_OWNED_PARAMS) {
    const v = params.get(k);
    if (v) next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// Minimal shape of Next's URLSearchParams we read.
type ReadonlyURLSearchParams = { get(key: string): string | null };

export function RecentPageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const href = normalizeHref(pathname, searchParams);
    if (!HREF_SET.has(href)) return;
    recordPageView(href);
  }, [pathname, searchParams]);
  return null;
}
