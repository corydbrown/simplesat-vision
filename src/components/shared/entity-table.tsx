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
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useColumnState } from "@/lib/column-prefs";
import { formatNumber } from "@/lib/format";
import type { Property } from "@/lib/properties/types";

export type EntityTableProps<T> = {
  rows: T[];
  idField: keyof T & string;
  properties: Property<T>[];
  stickyId?: string;
  page: number;
  pageSize: number;
  total: number;
  sort?: string;
  dir?: "asc" | "desc";
  basePath: string;
  rowHrefBase?: string;
  rowHrefField?: keyof T & string;
  emptyMessage?: string;
};

const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 800;

export function EntityTable<T>({
  rows,
  idField,
  properties,
  stickyId,
  page,
  pageSize,
  total,
  sort,
  dir,
  basePath,
  rowHrefBase,
  rowHrefField,
  emptyMessage = "No rows.",
}: EntityTableProps<T>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, setOrder, setWidth } = useColumnState();

  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const visibleOrdered = state.order
    .filter((id) => state.visibility[id] !== false && propertyMap[id])
    .map((id) => propertyMap[id]);

  function buildHref(updates: Record<string, string | number>): string {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      next.set(k, String(v));
    }
    return `${basePath}?${next.toString()}`;
  }

  function toggleSort(sortKey: string) {
    if (sort === sortKey) {
      router.push(buildHref({ sort: sortKey, dir: dir === "asc" ? "desc" : "asc" }));
    } else {
      router.push(buildHref({ sort: sortKey, dir: "desc", page: 1 }));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = visibleOrdered.map((p) => p.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    // Reorder within visible; merge back into full order.
    const newVisibleOrder = arrayMove(ids, oldIndex, newIndex);
    const hidden = state.order.filter((id) => !ids.includes(id));
    setOrder([...newVisibleOrder, ...hidden]);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center justify-between border-b border-border bg-background px-5 py-1.5">
        <div className="text-xs text-muted-foreground tabular-nums">
          {total === 0
            ? "0 rows"
            : `Showing ${formatNumber(firstRow)} - ${formatNumber(lastRow)} of ${formatNumber(total)}`}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="text-sm border-separate border-spacing-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleOrdered.map((p) => p.id)}
              strategy={horizontalListSortingStrategy}
            >
              <thead>
                <tr>
                  {visibleOrdered.map((p) => {
                    const width = state.widths[p.id] ?? p.width;
                    const sticky = p.id === stickyId;
                    return (
                      <HeaderCell
                        key={p.id}
                        property={p}
                        width={width}
                        sticky={sticky}
                        sortActive={sort === (p.sortKey ?? p.id)}
                        onSort={
                          p.sortable && (p.sortKey ?? p.id)
                            ? () => toggleSort(p.sortKey ?? p.id)
                            : undefined
                        }
                        onResize={(w) =>
                          setWidth(p.id, Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, w)))
                        }
                      />
                    );
                  })}
                </tr>
              </thead>
            </SortableContext>
          </DndContext>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleOrdered.length}
                  className="px-3 py-8 text-center text-sm text-muted-foreground border-b border-border"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row[idField] as unknown as string;
                const hrefId = rowHrefField
                  ? (row[rowHrefField] as unknown as string)
                  : id;
                const href = rowHrefBase ? `${rowHrefBase}/${hrefId}` : undefined;
                const handleClick = href
                  ? (e: React.MouseEvent) => {
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      router.push(href);
                    }
                  : undefined;
                return (
                  <tr
                    key={id}
                    className={`group ${href ? "cursor-pointer" : ""}`}
                    onClick={handleClick}
                  >
                    {visibleOrdered.map((p) => {
                      const width = state.widths[p.id] ?? p.width;
                      const sticky = p.id === stickyId;
                      return (
                        <td
                          key={p.id}
                          style={{
                            width,
                            minWidth: width,
                            maxWidth: width,
                            left: sticky ? 0 : undefined,
                          }}
                          className={`px-3 py-2 border-b border-r border-border align-middle bg-background group-hover:bg-accent/50 ${
                            p.truncate !== false ? "truncate" : ""
                          } ${
                            sticky
                              ? "sticky z-10 shadow-[1px_0_0_0_var(--color-border)]"
                              : ""
                          } ${p.align === "right" ? "text-right" : ""}`}
                        >
                          {p.cell(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border bg-background px-5 py-2">
        <div className="text-xs text-muted-foreground">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={buildHref({ page: Math.max(1, page - 1) })}
            aria-disabled={page <= 1}
            className={
              page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-accent rounded"
            }
          >
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ChevronLeft size={14} />
            </Button>
          </Link>
          <Link
            href={buildHref({ page: Math.min(totalPages, page + 1) })}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-accent rounded"
            }
          >
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <ChevronRight size={14} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeaderCell<T>({
  property,
  width,
  sticky,
  sortActive,
  onSort,
  onResize,
}: {
  property: Property<T>;
  width: number;
  sticky: boolean;
  sortActive: boolean;
  onSort?: () => void;
  onResize: (width: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: property.id });

  const dragStartRef = useRef<{ x: number; w: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragStartRef.current = { x: e.clientX, w: width };
      setResizing(true);
      const handlePointerMove = (ev: PointerEvent) => {
        if (!dragStartRef.current) return;
        const delta = ev.clientX - dragStartRef.current.x;
        onResize(dragStartRef.current.w + delta);
      };
      const handlePointerUp = () => {
        dragStartRef.current = null;
        setResizing(false);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [width, onResize],
  );

  return (
    <th
      ref={setNodeRef}
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        left: sticky ? 0 : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: sticky ? 30 : isDragging ? 25 : 20,
      }}
      className={`px-3 py-2 text-left font-medium text-xs text-muted-foreground border-b border-r border-border bg-background sticky top-0 ${
        sticky ? "shadow-[1px_0_0_0_var(--color-border)]" : ""
      } ${property.align === "right" ? "text-right" : ""}`}
    >
      <div className="flex items-center gap-1 relative">
        <span
          {...attributes}
          {...listeners}
          className="flex-1 cursor-grab truncate select-none active:cursor-grabbing"
        >
          {onSort ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSort();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              {property.label}
              <ChevronsUpDown
                size={11}
                className={
                  sortActive ? "text-foreground" : "text-muted-foreground/50"
                }
              />
            </button>
          ) : (
            <span>{property.label}</span>
          )}
        </span>
        <span
          onPointerDown={onPointerDown}
          className={`absolute right-[-6px] top-[-6px] bottom-[-6px] w-3 cursor-col-resize ${
            resizing ? "bg-foreground/20" : "hover:bg-foreground/10"
          }`}
        />
      </div>
    </th>
  );
}
