import { Link, useParams } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DrillRow } from "@/features/guardian/components/DrillRow";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";

/**
 * Step 3 of the results drill-down - a session's terms in term-number
 * order. An unpublished term is listed disabled rather than hidden, so the
 * guardian can see the school simply hasn't published it yet.
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

      <div className="space-y-3">
        {sessionTerms.map((term) =>
          term.resultsPublished ? (
            <DrillRow
              key={term.termId}
              to={`/guardian/results/${ward.studentId}/${sessionId}/${term.termId}`}
              title={term.termName}
              meta={term.className}
              trailing={<Badge variant="success">Published</Badge>}
            />
          ) : (
            <DrillRow key={term.termId} title={term.termName} disabled disabledReason="Not published yet" />
          ),
        )}
      </div>
    </div>
  );
}
