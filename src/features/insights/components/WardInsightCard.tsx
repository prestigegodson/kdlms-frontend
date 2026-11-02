import { Sparkles } from "lucide-react";
import type { Severity } from "@/api/insights";
import type { WardTermInsight } from "@/api/wards";
import { Badge } from "@/components/ui/Badge";
import { formatScore, SEVERITY_BADGE } from "@/features/insights/format";
import { useWardInsights } from "@/features/insights/hooks";
import { formatUpdated } from "@/utils/date";

/** Plain-language severity for a guardian; the badge keeps the staff view's status colours. */
const GUARDIAN_SEVERITY: Record<Severity, { label: string; summary: string }> = {
  NONE: { label: "On track", summary: "Nothing in this term's results, attendance or work needs your attention." },
  WATCH: { label: "Worth keeping an eye on", summary: "One area could do with a little attention:" },
  AT_RISK: { label: "Needs some support", summary: "A few areas could do with some extra support:" },
};

function percent(value: number | null): string {
  return value === null ? "—" : `${formatScore(value)}%`;
}

/**
 * The guardian portal's "How {name} is doing" section of a ward's card (insights Phase I6): the
 * latest published term's summary from `GET /api/v1/me/wards/{id}/insights`, with last term's
 * numbers beside it when there are two. Never shows class position. Hidden entirely when the ward's
 * school doesn't have insights, the read fails, or no term has been published yet (so there's no
 * summary to show), like the card's attendance tile.
 */
export function WardInsightCard({ studentId, firstName }: { studentId: string; firstName: string }) {
  const { state } = useWardInsights(studentId);

  if (state.kind !== "loaded" || state.data.terms.length === 0) {
    return null;
  }
  const { terms, computedAt } = state.data;
  const name = state.data.firstName || firstName;

  return (
    <section aria-label={`How ${name} is doing`} className="mt-4 rounded-panel border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">How {name} is doing</h3>
        </div>
        {computedAt && <span className="text-xs text-slate-500">{formatUpdated(computedAt)}</span>}
      </div>
      <TermSummary latest={terms[terms.length - 1]} previous={terms.length > 1 ? terms[terms.length - 2] : null} />
    </section>
  );
}

function TermSummary({ latest, previous }: { latest: WardTermInsight; previous: WardTermInsight | null }) {
  const severity = GUARDIAN_SEVERITY[latest.severity];
  const term = [latest.termName, latest.sessionName].filter(Boolean).join(", ");

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_BADGE[latest.severity].variant}>{severity.label}</Badge>
        {term && <span className="text-xs text-slate-500">{term}</span>}
      </div>
      <p className="text-sm text-slate-700">{severity.summary}</p>
      {latest.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {latest.reasons.map((reason) => (
            <li key={reason.signal}>{reason.message}</li>
          ))}
        </ul>
      )}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Term average</dt>
          <dd className="font-medium text-slate-900">
            {formatScore(latest.average)}
            {previous && previous.average !== null && (
              <span className="ml-1 text-xs font-normal text-slate-500">(last term {formatScore(previous.average)})</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Attendance</dt>
          <dd className="font-medium text-slate-900">
            {percent(latest.attendanceRate)}
            {previous && previous.attendanceRate !== null && (
              <span className="ml-1 text-xs font-normal text-slate-500">(last term {percent(previous.attendanceRate)})</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
