import { Skeleton } from "@/components/ui/Skeleton";

/** A placeholder matching `StatTile`'s shape - use while a dashboard/summary metric is still loading. */
export function StatTileSkeleton() {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="mt-3 h-7 w-16" />
    </div>
  );
}
