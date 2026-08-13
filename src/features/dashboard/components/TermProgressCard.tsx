import type { DashboardNextTerm, DashboardTermProgress } from "@/api/dashboard";
import { Card } from "@/components/ui/Card";
import { formatDateRange, formatLongDate } from "@/utils/date";

interface TermProgressCardProps {
  currentTerm: DashboardTermProgress;
  nextTerm?: DashboardNextTerm;
}

/**
 * The current term's own date range and how far through it the school is -
 * `currentTerm.daysRemaining` is already clamped to zero server-side for a
 * term whose end date has passed but hasn't been superseded yet, so the
 * rail never overshoots. `nextTerm` is omitted entirely (not just an empty
 * state) until a school admin has actually created the following term.
 */
export function TermProgressCard({ currentTerm, nextTerm }: TermProgressCardProps) {
  const totalDays = daysBetween(currentTerm.startDate, currentTerm.endDate);
  const elapsedDays = Math.max(0, totalDays - currentTerm.daysRemaining);
  const percent = totalDays === 0 ? 100 : Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{currentTerm.name}</h2>
        <p className="text-xs text-slate-500">{formatDateRange(currentTerm.startDate, currentTerm.endDate)}</p>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-xs text-slate-500">
          {currentTerm.daysRemaining > 0
            ? `Ends in ${currentTerm.daysRemaining} day${currentTerm.daysRemaining === 1 ? "" : "s"}`
            : "Ends today"}
        </p>
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

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}
