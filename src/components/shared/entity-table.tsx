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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useColumnState } from "@/lib/column-prefs";
import { formatNumber } from "@/lib/format";
import type { Property } from "@/lib/properties/types";
import type { DrawerEntity } from "./global-drawer";

export type EntityTableProps<T> = {
  rows: T[];
  idField: keyof T & string;
  properties: Property<T>[];
  page: number;
  pageSize: number;
  total: number;
  sort?: string;
  dir?: "asc" | "desc";
  /**
   * Base path used for sort/page links. When unset, defaults to the current
   * pathname so URL state (e.g. ?drawer=) is preserved.
   */
  basePath?: string;
  rowHrefField?: keyof T & string;
  /**
   * When set, row click opens the drawer for this entity instead of
   * navigating to its standalone page. Pairs with rowHrefField (or idField).
   */
  drawerEntity?: DrawerEntity;
  /**
   * Prefix for sort/dir/page params (e.g. "d" → dsort, ddir, dpage). Use
   * inside drawer-internal tables so they don't collide with outer page
   * sort state.
   */
  paramPrefix?: string;
  emptyMessage?: string;
};

const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 800;

export function EntityTable<T>({
  rows,
  idField,
  properties,
  page,
  pageSize,
  total,
  sort,
  dir,
  basePath,
  rowHrefField,
  drawerEntity,
  paramPrefix = "",
  emptyMessage = "No rows.",
}: EntityTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, setOrder, setWidth } = useColumnState();
  const sortKeyParam = `${paramPrefix}sort`;
  const dirKeyParam = `${paramPrefix}dir`;
  const pageKeyParam = `${paramPrefix}page`;
  const effectiveBasePath = basePath ?? pathname;

  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const visibleOrdered = state.order
    .filter((id) => state.visibility[id] !== false && propertyMap[id])
    .map((id) => propertyMap[id]);

  function buildHref(updates: Record<string, string | number>): string {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      next.set(k, String(v));
    }
    return `${effectiveBasePath}?${next.toString()}`;
  }

  function toggleSort(sortKey: string) {
    if (sort === sortKey) {
      router.push(
        buildHref({
          [sortKeyParam]: sortKey,
          [dirKeyParam]: dir === "asc" ? "desc" : "asc",
        }),
      );
    } else {
      router.push(
        buildHref({
          [sortKeyParam]: sortKey,
          [dirKeyParam]: "desc",
          [pageKeyParam]: 1,
        }),
      );
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
        <div className="text-base text-muted-foreground tabular-nums">
          {total === 0
            ? "0 rows"
            : `Showing ${formatNumber(firstRow)} - ${formatNumber(lastRow)} of ${formatNumber(total)}`}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="text-base border-separate border-spacing-0">
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
                    return (
                      <HeaderCell
                        key={p.id}
                        property={p}
                        width={width}
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
                  className="px-3 py-8 text-center text-base text-muted-foreground border-b border-border"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = row[idField] as unknown as string;
                const drawerId = rowHrefField
                  ? (row[rowHrefField] as unknown as string)
                  : id;
                const handleClick = drawerEntity
                  ? (e: React.MouseEvent) => {
                      const target = e.target as HTMLElement;
                      // Let pills/buttons inside the row handle their own clicks.
                      if (target.closest("a, button, [role='button']")) return;
                      if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.altKey ||
                        e.button !== 0
                      ) {
                        return;
                      }
                      const next = new URLSearchParams(searchParams.toString());
                      next.set("drawer", `${drawerEntity}:${drawerId}`);
                      next.delete("dt");
                      router.push(`${pathname}?${next.toString()}`, {
                        scroll: false,
                      });
                    }
                  : undefined;
                return (
                  <tr
                    key={id}
                    className={`group ${handleClick ? "cursor-pointer" : ""}`}
                    onClick={handleClick}
                  >
                    {visibleOrdered.map((p) => {
                      const width = state.widths[p.id] ?? p.width;
                      return (
                        <td
                          key={p.id}
                          style={{
                            width,
                            minWidth: width,
                            maxWidth: width,
                          }}
                          className={`px-3 py-3 border-b border-border align-middle bg-background group-hover:bg-accent/50 ${
                            p.truncate !== false ? "truncate" : ""
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
        <div className="text-base text-muted-foreground">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={buildHref({ [pageKeyParam]: Math.max(1, page - 1) })}
            aria-disabled={page <= 1}
            className={
              page <= 1
                ? "pointer-events-none opacity-40"
                : "hover:bg-accent rounded"
            }
          >
            <Button variant="ghost" size="sm" className="h-7 w-7 cursor-pointer p-0">
              <ChevronLeft size={14} />
            </Button>
          </Link>
          <Link
            href={buildHref({ [pageKeyParam]: Math.min(totalPages, page + 1) })}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-accent rounded"
            }
          >
            <Button variant="ghost" size="sm" className="h-7 w-7 cursor-pointer p-0">
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
  sortActive,
  onSort,
  onResize,
}: {
  property: Property<T>;
  width: number;
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
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 25 : 20,
      }}
      className={`px-3 py-3 text-left font-medium text-base text-muted-foreground border-b border-border bg-background sticky top-0 ${
        property.align === "right" ? "text-right" : ""
      }`}
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
              className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
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
