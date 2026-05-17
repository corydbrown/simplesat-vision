import { Plus } from "lucide-react";

export function SecondaryNav({
  title,
  count,
  children,
}: {
  title: string;
  count?: number | string;
  children: React.ReactNode;
}) {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-sidebar sticky top-0 h-screen">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-baseline gap-2">
          <div className="text-sm font-semibold">{title}</div>
          {count !== undefined && (
            <div className="text-xs tabular-nums text-muted-foreground">
              {count}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {children}
      </div>
    </aside>
  );
}

export function ViewsGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-2 pb-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
          {label}
        </div>
        <button
          type="button"
          aria-label="Add view"
          className="rounded p-0.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
