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
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
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
