import type { DashboardNextTerm, DashboardTermProgress } from "@/api/dashboard";
import { Card } from "@/components/ui/Card";
import { formatDateRange, formatLongDate, parseIsoDate } from "@/utils/date";

interface TermProgressCardProps {
  currentTerm: DashboardTermProgress;
  nextTerm?: DashboardNextTerm;
}

/**
 * The current term's own date range and how far through it the school is -
 * `currentTerm.daysRemaining` is signed, not clamped, so a term whose end
 * date has passed without a later term being marked current (the marker is
 * set explicitly, never inferred from today's date) reads as "Ended N days
 * ago" rather than an indefinite "Ends today". `nextTerm` is omitted
 * entirely (not just an empty state) until a school admin has actually
 * created the following term.
 */
export function TermProgressCard({ currentTerm, nextTerm }: TermProgressCardProps) {
  const totalDays = daysBetween(currentTerm.startDate, currentTerm.endDate);
  const elapsedDays = Math.max(0, totalDays - currentTerm.daysRemaining);
  const percent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{currentTerm.name}</h2>
        <p className="text-xs text-slate-500">{formatDateRange(currentTerm.startDate, currentTerm.endDate)}</p>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-xs text-slate-500">{daysRemainingLabel(currentTerm.daysRemaining)}</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {nextTerm && (
        <p className="mt-3 text-xs text-slate-500">
          Next: <span className="font-medium text-slate-700">{nextTerm.name}</span> starts{" "}
          {formatLongDate(nextTerm.startDate)}
        </p>
      )}
    </Card>
  );
}

function daysRemainingLabel(daysRemaining: number): string {
  if (daysRemaining > 0) {
    return `Ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  }
  if (daysRemaining === 0) {
    return "Ends today";
  }
  const daysAgo = -daysRemaining;
  return `Ended ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago - mark the next term current in Sessions & Terms`;
}

function daysBetween(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)?.getTime() ?? 0;
  const end = parseIsoDate(endIso)?.getTime() ?? 0;
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}
