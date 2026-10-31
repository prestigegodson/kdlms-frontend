import { ChevronRight, CircleCheck, TrendingDown } from "lucide-react";
import { Link } from "react-router";
import type { ClassSummary } from "@/api/insights";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useInsightsSummary } from "@/features/insights/hooks";
import { formatUpdated } from "@/utils/date";

const MAX_CLASS_ROWS = 5;

/** Classes with flags, most at-risk students first, then most on watch. */
function flaggedClasses(classes: ClassSummary[]): ClassSummary[] {
  return classes
    .filter((row) => row.atRisk + row.watch > 0)
    .sort((a, b) => b.atRisk - a.atRisk || b.watch - a.watch || a.className.localeCompare(b.className));
}

/**
 * The dashboard's "Students needing attention" card (insights Phase I4) - a self-fetching read of
 * `GET /api/v1/insights/summary`, already narrowed server-side to the caller's slice (school,
 * branch, headed levels or assigned classes). Like `NeedsAttentionCard`, it always renders once
 * shown, with an all-clear state, rather than vanishing when nothing is flagged.
 */
export function StudentsNeedingAttentionCard() {
  const { state } = useInsightsSummary();

  if (state.kind === "error" && state.notIncluded) {
    return null;
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">Students needing attention</h2>
        </div>
        {state.kind === "loaded" && (
          <span className="text-xs text-slate-500">
            {[state.data.termName, formatUpdated(state.data.computedAt)].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>

      {state.kind === "loading" && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {state.kind === "error" && <p className="mt-3 text-sm text-red-700">{state.message}</p>}
      {state.kind === "loaded" && <SummaryBody summary={state.data} />}
    </Card>
  );
}

function SummaryBody({ summary }: { summary: { atRisk: number; watch: number; computedAt?: string; classes: ClassSummary[] } }) {
  if (!summary.computedAt) {
    return (
      <p className="mt-3 text-sm text-slate-500">
        No insights yet. They&rsquo;re computed overnight, so check back tomorrow.
      </p>
    );
  }

  const classes = flaggedClasses(summary.classes);
  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
          <CircleCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">All clear</h3>
        <p className="mt-1 text-sm text-slate-500">No students are flagged this term.</p>
      </div>
    );
  }

  const shown = classes.slice(0, MAX_CLASS_ROWS);
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-6">
        <p>
          <span className="block font-display text-2xl font-medium text-slate-900 tabular-nums">{summary.atRisk}</span>
          <span className="text-xs text-slate-500">At risk</span>
        </p>
        <p>
          <span className="block font-display text-2xl font-medium text-slate-900 tabular-nums">{summary.watch}</span>
          <span className="text-xs text-slate-500">On watch</span>
        </p>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {shown.map((row) => (
          <li key={row.classId}>
            <Link
              to={`/school/insights?classId=${row.classId}`}
              className="-mx-2 flex min-h-11 items-center justify-between gap-2 rounded-control px-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="truncate">
                {row.className}
                {row.levelName && <span className="text-slate-400"> · {row.levelName}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {row.atRisk > 0 && <Badge variant="danger">{row.atRisk} at risk</Badge>}
                {row.watch > 0 && <Badge variant="warning">{row.watch} watch</Badge>}
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/school/insights" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand-600 hover:text-brand-700">
        View all insights
      </Link>
    </>
  );
}
