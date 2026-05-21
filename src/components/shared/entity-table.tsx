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
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useColumnState } from "@/lib/column-prefs";
import { formatNumber } from "@/lib/format";
import { applyMultiSort } from "@/lib/sort/compare";
import { parseSortParam } from "@/lib/sort/url-state";
import type { Property } from "@/lib/properties/types";
import type { DrawerEntity } from "./global-drawer";

export type EntityTableProps<T> = {
  rows: T[];
  idField: keyof T & string;
  properties: Property<T>[];
  page: number;
  pageSize: number;
  total: number;
  /**
   * Property id to group rows by. Property must declare groupable + groupValue.
   * Server queries pre-order rows so each group is contiguous (and nulls sort
   * last) on paginated pages; the table buckets defensively either way so
   * embedded tables work without server-side groupBy plumbing.
   */
  groupBy?: string;
  /**
   * Base path used for pagination links. Defaults to the current pathname so
   * URL state (e.g. ?drawer=) is preserved.
   */
  basePath?: string;
  rowHrefField?: keyof T & string;
  /**
   * When set, row click opens the drawer for this entity instead of
   * navigating to its standalone page. Pairs with rowHrefField (or idField).
   */
  drawerEntity?: DrawerEntity;
  /**
   * Prefix for sort/group/page params (e.g. "d" → dsort, dgroup, dpage). Use
   * inside drawer-internal tables so they don't collide with outer page state.
   */
  paramPrefix?: string;
  /**
   * When true, the parent already produced rows in sorted order (e.g. server
   * ORDER BY on a paginated list page). EntityTable will not sort in memory.
   * When false (default), EntityTable applies multi-sort client-side from
   * the URL using each property's sortValue accessor.
   */
  serverSorted?: boolean;
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
  groupBy,
  basePath,
  rowHrefField,
  drawerEntity,
  paramPrefix = "",
  serverSorted = false,
  emptyMessage = "No rows.",
}: EntityTableProps<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, setOrder, setWidth } = useColumnState();
  const pageKeyParam = `${paramPrefix}page`;
  const sortKeyParam = `${paramPrefix}sort`;
  const effectiveBasePath = basePath ?? pathname;

  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const visibleOrdered = state.order
    .filter((id) => state.visibility[id] !== false && propertyMap[id])
    .map((id) => propertyMap[id]);

  const displayRows = useMemo(() => {
    if (serverSorted) return rows;
    const sorts = parseSortParam(searchParams.get(sortKeyParam) ?? undefined);
    if (sorts.length === 0) return rows;
    return applyMultiSort(rows, sorts, properties);
  }, [rows, serverSorted, searchParams, sortKeyParam, properties]);

  const groupProp =
    groupBy && propertyMap[groupBy]?.groupable && propertyMap[groupBy]?.groupValue
      ? propertyMap[groupBy]
      : null;

  // Bucket the post-sort rows by groupValue. Insertion order preserves the
  // server's (or client multi-sort's) ordering of group keys; null bucket is
  // forced last.
  const sections = useMemo(() => {
    if (!groupProp) return null;
    const buckets = new Map<string | null, T[]>();
    for (const row of displayRows) {
      const key = groupProp.groupValue?.(row) ?? null;
      const list = buckets.get(key);
      if (list) list.push(row);
      else buckets.set(key, [row]);
    }
    const arr = [...buckets.entries()].map(([key, rs]) => ({ key, rows: rs }));
    const nullIdx = arr.findIndex((s) => s.key === null);
    if (nullIdx !== -1 && nullIdx !== arr.length - 1) {
      const [nullSec] = arr.splice(nullIdx, 1);
      arr.push(nullSec);
    }
    return arr;
  }, [displayRows, groupProp]);

  function buildHref(updates: Record<string, string | number>): string {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      next.set(k, String(v));
    }
    return `${effectiveBasePath}?${next.toString()}`;
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

  function renderDataRow(row: T) {
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
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleOrdered.length}
                  className="px-3 py-8 text-center text-base text-muted-foreground border-b border-border"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : sections && groupProp ? (
              sections.flatMap((section) => [
                <tr key={`__group:${section.key ?? "__null__"}`}>
                  <td
                    colSpan={visibleOrdered.length}
                    className="bg-muted/40 px-5 py-2 border-b border-border"
                  >
                    <span className="text-base">
                      <span className="text-muted-foreground/80">
                        {groupProp.label}
                      </span>
                      <span className="mx-1.5 text-muted-foreground/40">·</span>
                      <span className="font-medium text-foreground">
                        {section.key === null
                          ? (groupProp.nullGroupLabel ?? "(None)")
                          : (groupProp.groupLabel?.(section.key) ?? section.key)}
                      </span>
                      <span className="ml-2 tabular-nums text-muted-foreground/60">
                        {section.rows.length}
                      </span>
                    </span>
                  </td>
                </tr>,
                ...section.rows.map((row) => renderDataRow(row)),
              ])
            ) : (
              displayRows.map((row) => renderDataRow(row))
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
  onResize,
}: {
  property: Property<T>;
  width: number;
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
          {property.label}
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
