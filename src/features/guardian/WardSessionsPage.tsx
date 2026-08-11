import type { WardTermView } from "@/api/wards";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { WardResultsBreadcrumb } from "@/features/guardian/components/WardResultsBreadcrumb";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";

interface SessionSummary {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  className?: string;
  publishedCount: number;
}

function sessionsFrom(terms: WardTermView[]): SessionSummary[] {
  const bySessionId = new Map<string, SessionSummary>();
  for (const term of terms) {
    const existing = bySessionId.get(term.sessionId);
    if (existing) {
      if (term.resultsPublished) existing.publishedCount += 1;
      continue;
    }
    bySessionId.set(term.sessionId, {
      sessionId: term.sessionId,
      sessionName: term.sessionName,
      currentSession: term.currentSession,
      className: term.className,
      publishedCount: term.resultsPublished ? 1 : 0,
    });
  }
  return [...bySessionId.values()].sort((a, b) => {
    if (a.currentSession !== b.currentSession) return a.currentSession ? -1 : 1;
    return b.sessionName.localeCompare(a.sessionName);
  });
}

/**
 * Step 2 of the results drill-down - every session this ward has been
 * enrolled in, newest/current first. A session with nothing published yet
 * still shows (the ward's enrolment history stays visible) but is
 * non-tappable, matching step 3's treatment of an individual unpublished
 * term.
 */
export function WardSessionsPage() {
  const { ward, terms } = useWardResultsContext();
  const sessions = sessionsFrom(terms);

  return (
    <div className="space-y-6">
      <PageHeader title={ward.fullName} description={ward.schoolName} backTo="/guardian/results" />
      <WardResultsBreadcrumb steps={[{ label: ward.schoolName, to: "/guardian/results" }, { label: ward.fullName }]} />

      {sessions.length === 0 && (
        <EmptyState title="No enrolment history yet" description="This ward hasn't been enrolled for any session." />
      )}

      <div className="space-y-3">
        {sessions.map((session) =>
          session.publishedCount > 0 ? (
            <DrillRow
              key={session.sessionId}
              to={`/guardian/results/${ward.studentId}/${session.sessionId}`}
              title={session.sessionName}
              meta={session.className}
              trailing={
                <div className="flex items-center gap-2">
                  {session.currentSession && <Badge variant="brand">Current</Badge>}
                  <Badge variant="neutral">{session.publishedCount} published</Badge>
                </div>
              }
            />
          ) : (
            <DrillRow
              key={session.sessionId}
              title={session.sessionName}
              disabled
              disabledReason="No published results yet"
            />
          ),
        )}
      </div>
    </div>
  );
}
