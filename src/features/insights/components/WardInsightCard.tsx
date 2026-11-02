import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";
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
interface WardInsightCardProps {
  studentId: string;
  firstName: string;
  /**
   * Collapses the section to a one-line header (title + severity badge) that
   * expands to the full summary - for the guardian's compact ward cards.
   */
  collapsible?: boolean;
}

export function WardInsightCard({ studentId, firstName, collapsible = false }: WardInsightCardProps) {
  const { state } = useWardInsights(studentId);
  const [expanded, setExpanded] = useState(false);

  if (state.kind !== "loaded" || state.data.terms.length === 0) {
    return null;
  }
  const { terms, computedAt } = state.data;
  const name = state.data.firstName || firstName;
  const latest = terms[terms.length - 1];
  const previous = terms.length > 1 ? terms[terms.length - 2] : null;

  if (collapsible) {
    const panelId = `ward-insight-${studentId}`;
    return (
      <section aria-label={`How ${name} is doing`} className="mt-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((open) => !open)}
          className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-control px-2 py-1.5 text-left
            transition-colors hover:bg-slate-50 mobile:min-h-11"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">How {name} is doing</span>
          <Badge variant={SEVERITY_BADGE[latest.severity].variant}>{GUARDIAN_SEVERITY[latest.severity].label}</Badge>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {expanded && (
          <div id={panelId}>
            <TermSummary latest={latest} previous={previous} showBadge={false} />
            {computedAt && <p className="mt-3 text-xs text-slate-500">{formatUpdated(computedAt)}</p>}
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-label={`How ${name} is doing`} className="mt-4 rounded-panel border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">How {name} is doing</h3>
        </div>
        {computedAt && <span className="text-xs text-slate-500">{formatUpdated(computedAt)}</span>}
      </div>
      <TermSummary latest={latest} previous={previous} />
    </section>
  );
}

function TermSummary({
  latest,
  previous,
  showBadge = true,
}: {
  latest: WardTermInsight;
  previous: WardTermInsight | null;
  /** False when the collapsible header already shows the severity badge. */
  showBadge?: boolean;
}) {
  const severity = GUARDIAN_SEVERITY[latest.severity];
  const term = [latest.termName, latest.sessionName].filter(Boolean).join(", ");

  return (
    <div className="mt-3 space-y-3">
      {(showBadge || term) && (
        <div className="flex flex-wrap items-center gap-2">
          {showBadge && <Badge variant={SEVERITY_BADGE[latest.severity].variant}>{severity.label}</Badge>}
          {term && <span className="text-xs text-slate-500">{term}</span>}
        </div>
      )}
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
