import type { WardTermView } from "@/api/wards";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";
import { usePageParam } from "@/hooks/usePageParam";
import { paginate } from "@/utils/paginate";

const SESSIONS_PER_PAGE = 10;

interface SessionSummary {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  className?: string;
  publishedCount: number;
}

/** A term contributes up to two published result sets - mid-term and end-of-term publish independently. */
function publishedSetsOf(term: WardTermView): number {
  return (term.resultsPublished ? 1 : 0) + (term.midtermPublished ? 1 : 0);
}

function sessionsFrom(terms: WardTermView[]): SessionSummary[] {
  const bySessionId = new Map<string, SessionSummary>();
  for (const term of terms) {
    const existing = bySessionId.get(term.sessionId);
    if (existing) {
      existing.publishedCount += publishedSetsOf(term);
      continue;
    }
    bySessionId.set(term.sessionId, {
      sessionId: term.sessionId,
      sessionName: term.sessionName,
      currentSession: term.currentSession,
      className: term.className,
      publishedCount: publishedSetsOf(term),
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
  const [pageIndex, setPageIndex] = usePageParam();
  const page = paginate(sessions, pageIndex, SESSIONS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader title={ward.fullName} description={ward.schoolName} backTo="/guardian/results" />
      <WardBreadcrumb steps={[{ label: ward.schoolName, to: "/guardian/results" }, { label: ward.fullName }]} />

      {sessions.length === 0 && (
        <EmptyState title="No enrolment history yet" description="This ward hasn't been enrolled for any session." />
      )}

      <div className="space-y-3">
        {page.content.map((session) =>
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

      {page.totalPages > 1 && <Pagination page={page} onPageChange={setPageIndex} />}
    </div>
  );
}
