import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { getMyResult, type MyTermResultView } from "@/api/student";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { StudentTermResultCard } from "@/features/assessments/components/StudentTermResultCard";
import { TraitKey } from "@/features/assessments/components/TraitKey";
import { useStudentStore } from "@/stores/studentStore";

/**
 * The student portal's own term result - the `WardTermResultPage` shape, minus report preview/
 * PDF (35C's locked scope: on-screen result card, grade key and trait key only). `sessionId`/
 * `termId` come from the URL, so switching term remounts this page rather than needing a reset
 * dance. The backend 404s an unpublished term regardless of what the Results list offered, so
 * that case renders an explanatory empty state rather than a raw error - covers a stale
 * bookmark to a term unpublished after the fact.
 */
export function StudentTermResultPage() {
  const terms = useStudentStore((state) => state.terms);
  const { termId } = useParams<{ sessionId: string; termId: string }>();
  const [searchParams] = useSearchParams();
  const scope = searchParams.get("scope") === "MIDTERM" ? "MIDTERM" : "TERM";
  const [result, setResult] = useState<MyTermResultView | null>(null);
  const [notPublished, setNotPublished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A term or scope change resets the previous result during render (the `WardTermResultPage`
  // pattern) rather than inside the effect below, which only fetches.
  const resultKey = `${termId}|${scope}`;
  const [lastResultKey, setLastResultKey] = useState(resultKey);
  if (resultKey !== lastResultKey) {
    setLastResultKey(resultKey);
    setResult(null);
    setNotPublished(false);
    setLoadError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getMyResult(termId, scope)
      .then(setResult)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setNotPublished(true);
          return;
        }
        setLoadError(error instanceof ApiError ? error.message : "Failed to load result");
      });
  }, [termId, scope]);

  const term = terms.find((candidate) => candidate.termId === termId);
  const scopeSuffix = scope === "MIDTERM" ? " · Mid-term" : "";
  const title = term ? `${term.termName} · ${term.sessionName}${scopeSuffix}` : "Result";

  return (
    <div className="space-y-6">
      <PageHeader title={title} backTo="/student/results" />

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {notPublished && (
        <EmptyState
          title={scope === "MIDTERM" ? "Mid-term results not published yet" : "Results not published yet"}
          description={
            scope === "MIDTERM"
              ? "Your school hasn't published this term's mid-term results yet."
              : "Your school hasn't published this term's results yet."
          }
        />
      )}

      {!result && !notPublished && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading result…
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <StudentTermResultCard result={result.result} />
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Grade key</h2>
            <GradeKey system={result.gradingSystem} />
          </Card>
          {(result.traitConfiguration.affectiveEnabled || result.traitConfiguration.psychomotorEnabled) && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Behavioural traits key</h2>
              <TraitKey configuration={result.traitConfiguration} />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
