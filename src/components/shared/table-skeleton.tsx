import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="border-b border-border px-3 py-1.5">
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="border-b border-border px-3 py-2 flex items-center gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-24" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="border-b border-border px-3 py-2 flex items-center gap-6"
          >
            {Array.from({ length: 6 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-28" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
