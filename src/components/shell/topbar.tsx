import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Topbar({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <header className="sticky top-0 z-10 flex h-11 items-center gap-1 border-b border-border bg-background/95 backdrop-blur px-5 text-sm">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight size={14} className="text-muted-foreground" />
          )}
          {c.href ? (
            <a
              href={c.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {c.label}
            </a>
          ) : (
            <span
              className={
                i === crumbs.length - 1
                  ? "text-foreground"
                  : "text-muted-foreground"
              }
            >
              {c.label}
            </span>
          )}
        </span>
      ))}
    </header>
  );
}
