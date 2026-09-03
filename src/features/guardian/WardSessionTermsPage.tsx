import { Link, useParams } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";

/**
 * Step 3 of the results drill-down - a session's terms in term-number
 * order, each split into its two independently-published result sets (see
 * CLAUDE.md's ResultScope domain rule): a Mid-term row and an End of term
 * row, either of which may be published while the other isn't. An
 * unpublished row is listed disabled rather than hidden, so the guardian
 * can see the school simply hasn't published it yet. The Mid-term row links
 * to the same term route as End of term, with `?scope=MIDTERM` - the route
 * tree itself carries no separate scope segment.
 */
export function WardSessionTermsPage() {
  const { ward, terms } = useWardResultsContext();
  const { sessionId } = useParams<{ sessionId: string }>();

  const sessionTerms = terms
    .filter((term) => term.sessionId === sessionId)
    .sort((a, b) => a.termNumber - b.termNumber);

  if (sessionTerms.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Session not found" backTo={`/guardian/results/${ward.studentId}`} />
        <EmptyState
          title="Session not found"
          description="This session isn't part of this ward's enrolment history."
          action={
            <Link to={`/guardian/results/${ward.studentId}`} className="text-sm font-medium text-brand-700">
              Back to sessions
            </Link>
          }
        />
      </div>
    );
  }

  const sessionName = sessionTerms[0].sessionName;

  return (
    <div className="space-y-6">
      <PageHeader title={sessionName} backTo={`/guardian/results/${ward.studentId}`} />
      <WardBreadcrumb
        steps={[
          { label: ward.schoolName, to: "/guardian/results" },
          { label: ward.fullName, to: `/guardian/results/${ward.studentId}` },
          { label: sessionName },
        ]}
      />

      <div className="space-y-6">
        {sessionTerms.map((term) => (
          <div key={term.termId} className="space-y-2">
            <p className="text-sm font-medium text-slate-500">
              {term.termName}
              {term.className ? ` · ${term.className}` : ""}
            </p>
            <div className="space-y-2">
              {term.midtermPublished ? (
                <DrillRow
                  to={`/guardian/results/${ward.studentId}/${sessionId}/${term.termId}?scope=MIDTERM`}
                  title="Mid-term"
                  trailing={<Badge variant="success">Published</Badge>}
                />
              ) : (
                <DrillRow title="Mid-term" disabled disabledReason="Not published yet" />
              )}
              {term.resultsPublished ? (
                <DrillRow
                  to={`/guardian/results/${ward.studentId}/${sessionId}/${term.termId}`}
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
    </div>
  );
}
