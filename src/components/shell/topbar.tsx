import { ChevronRight } from "lucide-react";
import { BackButton } from "./back-button";

export type Crumb = { label: string; href?: string };

export function Topbar({ crumbs }: { crumbs: Crumb[] }) {
  const firstWithHref = crumbs.find((c) => c.href);
  const showBack = crumbs.length > 1 && firstWithHref;

  return (
    <header className="sticky top-0 z-10 flex h-11 items-center gap-1.5 border-b border-border bg-background/95 backdrop-blur px-3 text-sm">
      {showBack && <BackButton href={firstWithHref.href!} />}
      <div className="flex items-center gap-1 px-1">
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
      </div>
    </header>
  );
}
