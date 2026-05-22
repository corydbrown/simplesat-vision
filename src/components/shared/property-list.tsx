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
  return (
    <div className="pb-4 last:pb-0">
      {label && (
        <div className="pb-2 text-base font-medium text-muted-foreground">
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
}: {
  icon: PropertyIcon;
  label: string;
  children: React.ReactNode;
}) {
  const layout = useContext(LayoutContext);

  if (layout === "stacked") {
    return (
      <div className="-mx-2 rounded px-2 py-1 hover:bg-accent/40">
        <dt className="flex items-center gap-1.5 text-base text-muted-foreground">
          <Icon size={14} className="shrink-0 text-muted-foreground/70" />
          <span className="truncate">{label}</span>
        </dt>
        <dd className="mt-0.5 text-base text-foreground break-words">
          {children}
        </dd>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[170px_1fr] -mx-2 items-baseline gap-3 rounded px-2 py-1 hover:bg-accent/40">
      <dt className="flex items-center gap-1.5 text-base text-muted-foreground min-w-0">
        <Icon
          size={14}
          className="shrink-0 self-center text-muted-foreground/70"
        />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="min-w-0 text-base text-foreground break-words">{children}</dd>
    </div>
  );
}

PropertyList.Group = Group;
PropertyList.Row = Row;
