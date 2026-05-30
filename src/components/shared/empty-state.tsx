import { isValidElement, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconProp = LucideIcon | ReactNode;

/** Shared empty-state surface. Two variants:
 *
 *  - `card`: padded, ring-bordered card with optional title + description +
 *    action. Used for top-level "no items yet" empties on list pages
 *    (scorecards, auto-scoring rules).
 *  - `inline`: dashed-border box for inline empties inside detail sections /
 *    feed lists / coming-soon stubs.
 *
 *  Text size is always `text-base` — never `text-sm`. De-emphasis is via
 *  muted color per CLAUDE.md → Conventions ("De-emphasis is via muted color,
 *  not smaller size").
 *
 *  The `icon` slot accepts either a LucideIcon component (rendered with
 *  sensible defaults per variant) or any ReactNode so callers can pass a
 *  pre-styled icon element. `title` and `description` accept ReactNode so
 *  callers can embed inline elements (e.g. version pills) where needed.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "inline",
  className,
}: {
  icon?: IconProp;
  title?: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  variant?: "card" | "inline";
  className?: string;
}) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "rounded-xl bg-card px-6 py-10 text-center ring-1 ring-foreground/10",
          className,
        )}
      >
        {renderIcon(icon, "card")}
        {title ? (
          <h2 className="mt-3 text-base font-medium text-foreground">
            {title}
          </h2>
        ) : null}
        <p className="mx-auto mt-1 max-w-sm text-base text-muted-foreground">
          {description}
        </p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    );
  }

  // inline variant — left-aligned by default; centered when no icon and no
  // action via `text-center` on the className from the caller, e.g. for
  // simple "no results" messages.
  const iconNode = renderIcon(icon, "inline");
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/30 px-5 py-4 text-base text-muted-foreground",
        iconNode || action ? "flex items-start gap-3" : null,
        className,
      )}
    >
      {iconNode}
      <div className={cn("flex-1", action && "self-center")}>
        {title ? (
          <div className="text-base font-medium text-foreground">{title}</div>
        ) : null}
        <div>{description}</div>
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

function renderIcon(icon: IconProp | undefined, variant: "card" | "inline") {
  if (!icon) return null;
  // Pre-rendered element: pass through.
  if (isValidElement(icon)) return icon;
  // LucideIcon component: render with sensible defaults per variant.
  if (typeof icon === "function") {
    const Icon = icon as LucideIcon;
    if (variant === "card") {
      return (
        <Icon size={20} className="mx-auto text-blue-dark" aria-hidden />
      );
    }
    return (
      <Icon
        size={16}
        className="mt-0.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
    );
  }
  return null;
}
