"use client";

import {
  ArrowDownUp,
  Download,
  Filter,
  Group,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColumnsControl } from "./columns-control";
import type { Property } from "@/lib/properties/types";

export function EntityToolbar<T>({
  properties,
  searchPlaceholder = "Search...",
  trailing,
}: {
  properties: Property<T>[];
  searchPlaceholder?: string;
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
          className="h-8 pl-7 text-sm"
          disabled
        />
      </div>
      <ToolbarButton icon={<Filter size={13} />} label="Filter" badge={0} />
      <ToolbarButton icon={<Group size={13} />} label="Group by" />
      <ToolbarButton icon={<ArrowDownUp size={13} />} label="Sort" />
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
      className="h-8 cursor-pointer gap-1.5 text-sm text-muted-foreground"
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="rounded bg-muted px-1 py-0.5 text-[10px] tabular-nums">
          {badge}
        </span>
      )}
    </Button>
  );
}
