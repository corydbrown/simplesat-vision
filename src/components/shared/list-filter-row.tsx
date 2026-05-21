"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { FilterRow } from "@/components/shared/filter-row";
import { propertiesToDescriptors } from "@/lib/filters/adapters";
import {
  decodeFilters,
  encodeFilters,
} from "@/lib/filters/url-state";
import type { Filter } from "@/lib/filters/types";
import type { Property } from "@/lib/properties/types";

/** URL-driven controller around FilterRow for list pages. Reads/writes `?f=`. */
export function ListFilterRow<T>({
  properties,
  label,
}: {
  properties: Property<T>[];
  label?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = decodeFilters(searchParams.get("f"));
  const fields = useMemo(
    () => propertiesToDescriptors(properties),
    [properties],
  );

  const onChange = useCallback(
    (next: Filter[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) {
        params.delete("f");
      } else {
        params.set("f", encodeFilters(next));
      }
      // Reset to first page whenever filters change.
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex items-stretch border-b border-border bg-muted/10 px-3 py-1.5">
      <FilterRow
        fields={fields}
        filters={filters}
        onChange={onChange}
        label={label}
      />
    </div>
  );
}
