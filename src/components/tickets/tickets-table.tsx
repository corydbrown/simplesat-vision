"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Eye,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { TicketsRow } from "@/db/queries/tickets";
import type { SortDir, TicketSortKey } from "@/db/queries/tickets";

const SORTABLE: Record<string, TicketSortKey> = {
  subject: "subject",
  status: "status",
  channel: "channel",
  solvedAt: "solvedAt",
  closedAt: "closedAt",
};

export function TicketsTable({
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  columns,
}: {
  rows: TicketsRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: TicketSortKey;
  dir: SortDir;
  columns: ColumnDef<TicketsRow>[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visibility, setVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildHref(updates: Record<string, string | number>): string {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      next.set(k, String(v));
    }
    return `/tickets?${next.toString()}`;
  }

  function toggleSort(col: TicketSortKey) {
    if (sort === col) {
      router.push(buildHref({ sort, dir: dir === "asc" ? "desc" : "asc" }));
    } else {
      router.push(buildHref({ sort: col, dir: "desc", page: 1 }));
    }
  }

  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const headerGroups = useMemo(() => table.getHeaderGroups(), [table]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center justify-between border-b border-border bg-background px-5 py-1.5">
        <div className="text-xs text-muted-foreground">
          Showing {formatNumber(firstRow)} - {formatNumber(lastRow)} of{" "}
          {formatNumber(total)}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
            >
              <Eye size={12} />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table.getAllLeafColumns().map((column) => {
              if (column.id === "id") return null;
              const meta = column.columnDef.meta as
                | { label?: string }
                | undefined;
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background">
            {headerGroups.map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => {
                  const sortKey = SORTABLE[header.column.id];
                  const isActive = sortKey === sort;
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2 text-left font-medium text-xs text-muted-foreground border-r border-border last:border-r-0"
                    >
                      {sortKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(sortKey)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <ChevronsUpDown
                            size={11}
                            className={
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground/60"
                            }
                          />
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-border last:border-b-0 hover:bg-accent/40 cursor-pointer"
                onClick={() => router.push(`/tickets/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-1.5 border-r border-border last:border-r-0 align-middle"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
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
