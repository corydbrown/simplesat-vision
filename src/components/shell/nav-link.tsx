"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function PrimaryNavLink({
  href,
  icon,
  label,
  match,
  dim,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  match: string;
  dim?: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    match === "/" ? pathname === "/" : pathname.startsWith(match);

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
        isActive
          ? "bg-foreground text-background"
          : dim
            ? "text-muted-foreground/60 hover:bg-accent hover:text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {icon}
    </Link>
  );
}

export function ViewNavLink({
  href,
  label,
  viewId,
  count,
  dim,
}: {
  href: string;
  label: string;
  viewId: string;
  count?: number | string;
  dim?: boolean;
}) {
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") ?? "all";
  const isActive = currentView === viewId;

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
        isActive
          ? "bg-accent text-foreground font-medium"
          : dim
            ? "text-muted-foreground/60 hover:bg-accent/60 hover:text-foreground"
            : "text-foreground/80 hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
