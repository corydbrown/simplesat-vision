"use client";

import { Download, Group, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnsControl } from "./columns-control";
import { SortControl } from "./sort-control";
import type { Property } from "@/lib/properties/types";

export function EntityToolbar<T>({
  properties,
  searchPlaceholder = "Search...",
  paramPrefix = "",
  trailing,
}: {
  properties: Property<T>[];
  searchPlaceholder?: string;
  paramPrefix?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-background px-5 py-2">
      <div className="relative w-72">
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          placeholder={searchPlaceholder}
          className="h-8 pl-7 text-base"
          disabled
        />
      </div>
      <ToolbarButton icon={<Group size={13} />} label="Group by" />
      <SortControl properties={properties} paramPrefix={paramPrefix} />
      <ColumnsControl properties={properties} />
      <div className="flex-1" />
      {trailing}
      <ToolbarButton icon={<Download size={13} />} label="Export" />
      <Button size="sm" className="h-8 cursor-pointer gap-1.5">
        <Plus size={13} />
        New
      </Button>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 cursor-pointer gap-1.5 text-base text-muted-foreground"
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="rounded bg-muted px-1 py-0.5 text-xs tabular-nums">
          {badge}
        </span>
      )}
    </Button>
  );
}
