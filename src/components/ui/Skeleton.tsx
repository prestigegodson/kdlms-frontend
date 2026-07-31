interface SkeletonProps {
  className?: string;
}

/** A pulsing placeholder block for content that's still loading - use in place of a bare "Loading…" row wherever the eventual shape (a line, a row, a card) is already known. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-pulse rounded-control bg-slate-200 ${className}`} />;
}
