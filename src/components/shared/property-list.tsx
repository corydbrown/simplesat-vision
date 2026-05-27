// Definition-list-based property panel. Compound API:
//
//   <PropertyList layout="stacked">
//     <PropertyList.Group label="Customer">
//       <PropertyList.Row icon={Mail} label="Email">jane@example.com</PropertyList.Row>
//     </PropertyList.Group>
//   </PropertyList>
//
// Two layouts:
//   - "inline" (default): label left (170px), value right. For wide
//     contexts like drawers where horizontal space is available.
//   - "stacked": label above value. For narrow contexts like the
//     standalone-page right sidebar.
//
// Renders semantic <dl><dt><dd> for screen readers. Layout is provided
// through a tiny context so consumers compose <Group>/<Row> without
// having to pass layout through each one. The icon column is required —
// it ships from the Property descriptor (Lucide component) and is rendered
// at a fixed muted style next to the label.

"use client";

import { createContext, useContext } from "react";
import { CopyableValue } from "@/components/shared/copyable-value";
import type { PropertyIcon } from "@/lib/properties/types";

type Layout = "inline" | "stacked";
const LayoutContext = createContext<Layout>("inline");

export function PropertyList({
  layout = "inline",
  children,
}: {
  layout?: Layout;
  children: React.ReactNode;
}) {
  return (
    <LayoutContext.Provider value={layout}>
      <dl>{children}</dl>
    </LayoutContext.Provider>
  );
}

function Group({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  // Group headers sit under the panel's "Properties" title. Smaller +
  // semibold + muted gives them a clear sub-section feel without violating
  // the de-emphasis-via-color rule (size delta is hierarchy, not
  // de-emphasis). The /40 placeholder dash inside values is left alone by
  // the dd value-color override below.
  return (
    <div className="pb-4 last:pb-0">
      {label && (
        <div className="pb-2 text-sm font-semibold text-muted-foreground">
          {label}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
  copyable = false,
}: {
  icon: PropertyIcon;
  label: string;
  children: React.ReactNode;
  /** When true, wrap the value in a hover-to-copy affordance. Reserved for
   *  plain text/number/id values; interactive pills opt out (they carry their
   *  own affordances). The `group/proprow` on the row container drives the
   *  copy button's hover reveal. */
  copyable?: boolean;
}) {
  const layout = useContext(LayoutContext);
  const value = copyable ? <CopyableValue>{children}</CopyableValue> : children;

  // Value override: `[&_.text-muted-foreground]:text-foreground` promotes any
  // muted-text descendants (which are normal in tables for secondary metadata
  // like emails, IDs, dates) back to foreground inside the panel. Empty-value
  // placeholders use `text-muted-foreground/40` — a distinct class — so they
  // remain visibly faint. Stateful pills don't use the muted class at all, so
  // they're untouched.
  if (layout === "stacked") {
    return (
      <div className="group/proprow -mx-2 rounded px-2 py-1 hover:bg-accent/40">
        <dt className="flex items-center gap-1.5 text-base text-muted-foreground">
          <Icon size={14} className="shrink-0 text-muted-foreground/70" />
          <span className="truncate">{label}</span>
        </dt>
        <dd className="mt-0.5 text-base text-foreground break-words [&_.text-muted-foreground]:text-foreground">
          {value}
        </dd>
      </div>
    );
  }

  return (
    <div className="group/proprow grid grid-cols-[170px_1fr] -mx-2 items-baseline gap-3 rounded px-2 py-1 hover:bg-accent/40">
      <dt className="flex items-center gap-1.5 text-base text-muted-foreground min-w-0">
        <Icon
          size={14}
          className="shrink-0 self-center text-muted-foreground/70"
        />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 text-base text-foreground break-words [&_.text-muted-foreground]:text-foreground">
        {value}
      </dd>
    </div>
  );
}

PropertyList.Group = Group;
PropertyList.Row = Row;
