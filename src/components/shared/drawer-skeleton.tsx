import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shape-aware skeleton for the drawer body. Mirrors the common layout of
 * the real entity-detail bodies — header row (avatar + name + secondary
 * line), a column of property rows, then a content block — so the swap
 * to real content reads as continuity rather than a layout pop.
 *
 * The exact entity body shape varies (customer / ticket / team-member /
 * response / survey), but they're all close enough that one shared
 * skeleton reads as "loading this entity". Per SVP-170: a single
 * skeleton beats five entity-specific ones, since the win is anchoring
 * the eye on the right *region*, not pixel-matching the final layout.
 */
export function DrawerBodySkeleton() {
  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 flex-1 max-w-[220px]" />
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
