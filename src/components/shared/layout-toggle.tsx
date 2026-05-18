"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function LayoutToggle({
  basePath,
  options,
}: {
  basePath: string;
  options: { value: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  const current = searchParams.get("layout") ?? options[0].value;

  function buildHref(value: string): string {
    const next = new URLSearchParams(searchParams.toString());
    if (value === options[0].value) {
      next.delete("layout");
    } else {
      next.set("layout", value);
    }
    const qs = next.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center rounded-md border border-border p-0.5">
      {options.map((o) => (
        <Link
          key={o.value}
          href={buildHref(o.value)}
          className={`px-2 py-1 text-xs rounded ${
            current === o.value
              ? "bg-accent text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
