import { useEffect } from "react";
import type { StudentTermView } from "@/api/student";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { usePageParam } from "@/hooks/usePageParam";
import { useStudentStore } from "@/stores/studentStore";
import { paginate } from "@/utils/paginate";

/** Paged by whole session - a session's terms never split across two pages. */
const SESSIONS_PER_PAGE = 5;

interface SessionGroup {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  terms: StudentTermView[];
}

function sessionsFrom(terms: StudentTermView[]): SessionGroup[] {
  const bySessionId = new Map<string, SessionGroup>();
  for (const term of terms) {
    const existing = bySessionId.get(term.sessionId);
    if (existing) {
      existing.terms.push(term);
      continue;
    }
    bySessionId.set(term.sessionId, {
      sessionId: term.sessionId,
      sessionName: term.sessionName,
      currentSession: term.currentSession,
      terms: [term],
    });
  }
  for (const group of bySessionId.values()) {
    group.terms.sort((a, b) => a.termNumber - b.termNumber);
  }
  return [...bySessionId.values()].sort((a, b) => {
    if (a.currentSession !== b.currentSession) return a.currentSession ? -1 : 1;
    return b.sessionName.localeCompare(a.sessionName);
  });
}

/**
 * The student portal's Results tab - every session the caller has been enrolled in, newest/
 * current first, each term split into its two independently-published result sets. Flatter than
 * the guardian drill-down (school → ward → session → term): there's one student and no ward
 * selector, so session → term is the whole tree - the `WardSessionsPage`/`WardSessionTermsPage`
 * pair collapsed into one page.
 */
export function StudentResultsPage() {
  const terms = useStudentStore((state) => state.terms);
  const status = useStudentStore((state) => state.status);
  const errorMessage = useStudentStore((state) => state.errorMessage);
  const fetchIfNeeded = useStudentStore((state) => state.fetchIfNeeded);
  const retry = useStudentStore((state) => state.retry);
  const [pageIndex, setPageIndex] = usePageParam();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  if (status === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Results" />
        <ErrorState message={errorMessage ?? "Failed to load your results"} onRetry={retry} />
      </div>
    );
  }

  if (status !== "loaded") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading…
      </div>
    );
  }

  const sessions = sessionsFrom(terms);
  const page = paginate(sessions, pageIndex, SESSIONS_PER_PAGE);

  return (
    <div className="space-y-6">
      <PageHeader title="Results" />

      {sessions.length === 0 && (
        <EmptyState title="No enrolment history yet" description="You haven't been enrolled for any session." />
      )}

      <div className="space-y-6">
        {page.content.map((session) => (
          <div key={session.sessionId} className="space-y-2">
            <p className="text-sm font-medium text-slate-500">
              {session.sessionName}
              {session.currentSession && <Badge variant="brand" className="ml-2">Current</Badge>}
            </p>
            {session.terms.map((term) => (
              <div key={term.termId} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {term.termName}
                  {term.className ? ` · ${term.className}` : ""}
                </p>
                <div className="space-y-2">
                  {term.midtermPublished ? (
                    <DrillRow
                      to={`/student/results/${session.sessionId}/${term.termId}?scope=MIDTERM`}
                      title="Mid-term"
                      trailing={<Badge variant="success">Published</Badge>}
                    />
                  ) : (
                    <DrillRow title="Mid-term" disabled disabledReason="Not published yet" />
                  )}
                  {term.resultsPublished ? (
                    <DrillRow
                      to={`/student/results/${session.sessionId}/${term.termId}`}
                      title="End of term"
                      trailing={<Badge variant="success">Published</Badge>}
                    />
                  ) : (
                    <DrillRow title="End of term" disabled disabledReason="Not published yet" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {page.totalPages > 1 && <Pagination page={page} onPageChange={setPageIndex} />}
    </div>
  );
}
