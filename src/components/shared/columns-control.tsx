"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useColumnState } from "@/lib/column-prefs";
import type { Property } from "@/lib/properties/types";

/** "Properties" view-options trigger. Uses Lucide SlidersHorizontal to match
 *  the Notion / Linear / Airtable convention. Opens a popover with:
 *    - Search input filtering by label
 *    - Show all / Hide all toggle (skips alwaysVisible)
 *    - Drag handle (dnd-kit) to reorder
 *    - Per-row visibility checkbox */
export function ColumnsControl<T>({
  properties,
}: {
  properties: Property<T>[];
}) {
  const { state, setVisibility, setOrder } = useColumnState();
  const [query, setQuery] = useState("");

  const ordered = useMemo(() => {
    const byId = new Map(properties.map((p) => [p.id, p] as const));
    const out: Property<T>[] = [];
    for (const id of state.order) {
      const p = byId.get(id);
      if (p) out.push(p);
    }
    // Any property without an entry in `order` (e.g. newly added) appended.
    for (const p of properties) {
      if (!state.order.includes(p.id)) out.push(p);
    }
    return out;
  }, [properties, state.order]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((p) => p.label.toLowerCase().includes(q));
  }, [ordered, query]);

  const toggleableIds = useMemo(
    () =>
      properties
        .filter((p) => !p.alwaysVisible)
        .map((p) => p.id),
    [properties],
  );
  const anyVisible = toggleableIds.some(
    (id) => state.visibility[id] !== false,
  );

  function showAll() {
    for (const id of toggleableIds) setVisibility(id, true);
  }
  function hideAll() {
    for (const id of toggleableIds) setVisibility(id, false);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fullOrder = ordered.map((p) => p.id);
    const oldIndex = fullOrder.indexOf(String(active.id));
    const newIndex = fullOrder.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(fullOrder, oldIndex, newIndex));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 cursor-pointer gap-1.5 text-base text-muted-foreground"
        >
          <SlidersHorizontal size={13} />
          Properties
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2">
          <div className="relative flex-1">
            <Search
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties"
              className="h-7 pl-7 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border">
          <span className="text-sm text-muted-foreground">
            {filtered.length} of {properties.length}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer px-2 text-xs"
              onClick={showAll}
              disabled={toggleableIds.length === 0}
            >
              Show all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer px-2 text-xs"
              onClick={hideAll}
              disabled={toggleableIds.length === 0 || !anyVisible}
            >
              Hide all
            </Button>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              No matches
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={filtered.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {filtered.map((p) => (
                  <PropertyRow
                    key={p.id}
                    property={p}
                    checked={state.visibility[p.id] !== false}
                    onToggle={(v) => setVisibility(p.id, v)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PropertyRow<T>({
  property,
  checked,
  onToggle,
}: {
  property: Property<T>;
  checked: boolean;
  onToggle: (v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: property.id });
  const Icon = property.icon;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-accent/40"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="flex h-7 w-5 cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Reorder property"
      >
        <GripVertical size={13} />
      </button>
      <Icon size={13} className="shrink-0 text-muted-foreground/70" />
      <label className="flex flex-1 cursor-pointer items-center gap-2 truncate px-1 py-1 text-sm">
        <span className="truncate">{property.label}</span>
      </label>
      {property.alwaysVisible ? (
        <span className="px-2 text-xs text-muted-foreground">always</span>
      ) : (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mr-1 h-3.5 w-3.5 cursor-pointer accent-foreground"
          aria-label={`${checked ? "Hide" : "Show"} ${property.label}`}
        />
      )}
    </div>
  );
}
