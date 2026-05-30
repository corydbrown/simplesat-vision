import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared header for settings pages.
 *
 *  Renders `<h1>` title (with optional inline suffix node — e.g. a version
 *  pill on the scorecard editor) + muted description + optional trailing
 *  action slot. The 6 settings pages all repeat the same shape; this is the
 *  single owner.
 *
 *  Layout: if an `action` is provided, the header becomes a 2-column
 *  baseline-aligned flex row (action on the right). Otherwise the header is
 *  a simple stack. `titleSuffix` renders next to the `<h1>` inline.
 */
export function SettingsPageHeader({
  title,
  titleSuffix,
  description,
  action,
  className,
}: {
  title: string;
  /** Optional node rendered next to the title on the same baseline.
   *  Used for the scorecard-editor version pill. */
  titleSuffix?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const heading = (
    <div>
      {titleSuffix ? (
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {titleSuffix}
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
      )}
      {description ? (
        <p className="mt-2 text-base text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );

  if (!action) {
    return <div className={className}>{heading}</div>;
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        className,
      )}
    >
      {heading}
      <div className="shrink-0">{action}</div>
    </div>
  );
}
