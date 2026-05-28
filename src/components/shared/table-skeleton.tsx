import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="border-b border-border px-gutter py-1.5">
        <Skeleton className="h-4 w-48" />
      </div>
      <EntityTableSkeleton rows={rows} />
    </div>
  );
}

// Chrome-less variant for use inside a Suspense boundary where the page
// header / toolbar / filter row are rendered synchronously by the shell.
// Only the data region paints a skeleton; everything around it is real.
export function EntityTableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="border-b border-border px-gutter py-2 flex items-center gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border px-gutter py-2 flex items-center gap-6"
        >
          {Array.from({ length: 6 }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-28" />
          ))}
        </div>
      ))}
    </div>
  );
}
