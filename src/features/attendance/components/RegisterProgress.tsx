interface RegisterProgressProps {
  markedCount: number;
  totalCount: number;
  /** Noun for the remaining-count line, e.g. "student" (default) or "class". */
  itemLabel?: string;
  /**
   * Past-tense verb for both lines, e.g. "marked" (default) or "published" -
   * the dashboard's publication-progress card reuses this component for
   * something that's published, not marked, and "3 classes still unmarked"
   * would misdescribe an unpublished class.
   */
  verbLabel?: string;
}

/**
 * A register can't be saved half-marked (CLAUDE.md: every student needs an
 * explicit status), so the teacher needs to see how far they've got. A
 * brand-filled rail plus a plain count of what's left - honest information,
 * not decoration. `itemLabel` lets Phase 9's dashboard landing page reuse
 * this for "X of Y classes have taken today's register" without the
 * remaining-count line lying about what's left.
 */
export function RegisterProgress({
  markedCount,
  totalCount,
  itemLabel = "student",
  verbLabel = "marked",
}: RegisterProgressProps) {
  const percent = totalCount === 0 ? 0 : Math.round((markedCount / totalCount) * 100);
  const remaining = totalCount - markedCount;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {markedCount} of {totalCount} {verbLabel}
        </span>
        {remaining > 0 && (
          <span>
            {remaining} {itemLabel}
            {remaining === 1 ? "" : "s"} still un{verbLabel}
          </span>
        )}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
