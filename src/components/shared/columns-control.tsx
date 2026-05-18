"use client";

import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useColumnState } from "@/lib/column-prefs";
import type { Property } from "@/lib/properties/types";

export function ColumnsControl<T>({
  properties,
}: {
  properties: Property<T>[];
}) {
  const { state, setVisibility, reset } = useColumnState();

  const groups = new Map<string, Property<T>[]>();
  for (const p of properties) {
    const g = p.group ?? "Other";
    const arr = groups.get(g) ?? [];
    arr.push(p);
    groups.set(g, arr);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-sm text-muted-foreground"
        >
          <Eye size={13} />
          Properties
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel>Show / hide properties</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {[...groups.entries()].map(([groupLabel, props]) => (
          <div key={groupLabel}>
            <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
              {groupLabel}
            </div>
            {props.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.id}
                checked={state.visibility[p.id] !== false}
                disabled={p.alwaysVisible}
                onCheckedChange={(value) => setVisibility(p.id, !!value)}
                onSelect={(e) => e.preventDefault()}
              >
                {p.label}
                {p.alwaysVisible && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    always
                  </span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => reset()}>
          Reset to defaults
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
