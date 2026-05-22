"use client";

import { ColumnsControl } from "@/components/shared/columns-control";
import type { Property } from "@/lib/properties/types";

export function DetailSection({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-base font-medium text-muted-foreground">{title}</h2>
        {trailing}
      </div>
      {children}
    </section>
  );
}

export function PropertiesHeader<T>({
  properties,
}: {
  properties: Property<T>[];
}) {
  return <ColumnsControl properties={properties} />;
}

/** Sidebar wrapper for the standalone (single-entity) detail page.
 *  Bordered container, responsive width clamped between 260 and 300px.
 *  Drawer layouts skip this — the drawer's own chrome already provides
 *  enclosure. */
export function PropertiesSidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside
      style={{ width: "clamp(260px, 22vw, 300px)" }}
      className="sticky top-14 self-start rounded-lg border border-border bg-background px-4 py-3"
    >
      {children}
    </aside>
  );
}
