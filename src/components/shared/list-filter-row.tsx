"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterRow } from "@/components/shared/filter-row";
import { propertiesToDescriptors } from "@/lib/filters/adapters";
import {
  decodeFilters,
  encodeFilters,
} from "@/lib/filters/url-state";
import type { Filter } from "@/lib/filters/types";
import type { Property } from "@/lib/properties/types";

/** URL-driven controller around FilterRow for list pages. Reads/writes `?f=`.
 *  Holds the chip list in local state so chips mount synchronously when added
 *  — the URL update (and the server refetch it triggers) happens behind the
 *  already-rendered chip rather than gating it. */
export function ListFilterRow<T>({
  properties,
}: {
  properties: Property<T>[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEncoded = searchParams.get("f") ?? "";
  const [filters, setFilters] = useState<Filter[]>(() =>
    decodeFilters(urlEncoded),
  );
  // Tracks the encoded URL value we last wrote ourselves. When the URL changes
  // to something different (back/forward, deep link, external nav), reconcile
  // local state from the URL.
  const lastSyncedRef = useRef<string>(urlEncoded);

  useEffect(() => {
    if (urlEncoded !== lastSyncedRef.current) {
      lastSyncedRef.current = urlEncoded;
      setFilters(decodeFilters(urlEncoded));
    }
  }, [urlEncoded]);

  const fields = useMemo(
    () => propertiesToDescriptors(properties),
    [properties],
  );

  const onChange = useCallback(
    (next: Filter[]) => {
      setFilters(next);
      const encoded = next.length === 0 ? "" : encodeFilters(next);
      lastSyncedRef.current = encoded;
      const params = new URLSearchParams(searchParams.toString());
      if (encoded) params.set("f", encoded);
      else params.delete("f");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex items-stretch border-b border-border bg-muted/10 px-3 py-1.5">
      <FilterRow fields={fields} filters={filters} onChange={onChange} />
    </div>
  );
}
