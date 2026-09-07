import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { can } from "@/auth/permissions";
import { ApiError } from "@/api/client";
import {
  clearTakeHomeQuizScoreAdjustment,
  getTakeHomeQuiz,
  getTakeHomeQuizResults,
  type StudentResultRowView,
  type TakeHomeQuizResultsView,
  type TakeHomeQuizView,
  unpublishTakeHomeQuizResults,
} from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { AdjustScoreModal } from "@/features/takeHomeQuizzes/components/AdjustScoreModal";
import { PublishResultsModal } from "@/features/takeHomeQuizzes/components/PublishResultsModal";
import { ResetAttemptDialog } from "@/features/takeHomeQuizzes/components/ResetAttemptDialog";
import { ResultsTable } from "@/features/takeHomeQuizzes/components/ResultsTable";
import { StudentAnswersModal } from "@/features/takeHomeQuizzes/components/StudentAnswersModal";
import { quizStatusLabel, quizStatusVariant } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";

/**
 * The teacher's results review screen (Phase 20E) - a per-student grading
 * grid reached from the editor page's "Results" action once a quiz is no
 * longer `DRAFT`. Its own route (`/school/take-home-quizzes/:quizId/results`)
 * rather than a panel bolted onto the editor, so that page doesn't grow a
 * third major section (form + questions + links + results).
 */
export function TakeHomeQuizResultsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.takeHomeQuiz);
  const canAdjust = can.adjustTakeHomeQuizScore(role, entitled);
  const canReset = can.authorTakeHomeQuizzes(role, entitled);
  const canPublishResults = can.publishTakeHomeQuizResults(role, entitled);

  const [quiz, setQuiz] = useState<TakeHomeQuizView | null>(null);
  const [results, setResults] = useState<TakeHomeQuizResultsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [answersTarget, setAnswersTarget] = useState<StudentResultRowView | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<StudentResultRowView | null>(null);
  const [resetTarget, setResetTarget] = useState<StudentResultRowView | null>(null);
  const [publishResultsOpen, setPublishResultsOpen] = useState(false);
  const [unpublishResultsOpen, setUnpublishResultsOpen] = useState(false);

  const load = useCallback(() => {
    if (!quizId) return;
    Promise.all([getTakeHomeQuiz(quizId), getTakeHomeQuizResults(quizId)])
      .then(([quizView, resultsView]) => {
        setQuiz(quizView);
        setResults(resultsView);
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load results"));
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  function refetch() {
    setReloadToken((token) => token + 1);
  }

  async function handleClearAdjustment(row: StudentResultRowView) {
    setActionError(null);
    try {
      await clearTakeHomeQuizScoreAdjustment(quizId!, row.studentId);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not clear this adjustment");
    }
  }

  if (loadError) {
    return <Alert variant="error">{loadError}</Alert>;
  }
  if (!quiz || !results) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading results…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={quiz.title}
        description={`${quiz.subjectName} · ${quiz.className} · ${results.totalPoints} points`}
        backTo={`/school/take-home-quizzes/${quiz.id}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canPublishResults && quiz.actions.canPublishResults && (
              <Button variant="accent" onClick={() => setPublishResultsOpen(true)}>
                Publish results
              </Button>
            )}
            {canPublishResults && quiz.actions.canUnpublishResults && (
              <Button variant="secondary" onClick={() => setUnpublishResultsOpen(true)}>
                Unpublish results
              </Button>
            )}
          </div>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Badge variant={quizStatusVariant(quiz.status, null)}>{quizStatusLabel(quiz.status, null)}</Badge>
        <span>
          {results.submittedCount} of {results.rosterSize} students submitted
        </span>
      </div>

      {results.rows.length === 0 ? (
        <EmptyState title="No students on this class's roster yet" />
      ) : (
        <ResultsTable
          rows={results.rows}
          totalPoints={results.totalPoints}
          canAdjust={canAdjust}
          canReset={canReset}
          onViewAnswers={setAnswersTarget}
          onAdjust={setAdjustTarget}
          onClearAdjustment={handleClearAdjustment}
          onReset={setResetTarget}
        />
      )}

      {answersTarget && quizId && (
        <StudentAnswersModal
          quizId={quizId}
          studentId={answersTarget.studentId}
          studentName={answersTarget.fullName}
          onClose={() => setAnswersTarget(null)}
        />
      )}

      {adjustTarget && quizId && (
        <AdjustScoreModal
          quizId={quizId}
          studentId={adjustTarget.studentId}
          studentName={adjustTarget.fullName}
          currentScore={adjustTarget.effectiveScore}
          totalPoints={results.totalPoints}
          onClose={() => setAdjustTarget(null)}
          onAdjusted={() => {
            setAdjustTarget(null);
            refetch();
          }}
        />
      )}

      {resetTarget && quizId && (
        <ResetAttemptDialog
          quizId={quizId}
          studentId={resetTarget.studentId}
          studentName={resetTarget.fullName}
          onClose={() => setResetTarget(null)}
          onReset={() => {
            setResetTarget(null);
            refetch();
          }}
        />
      )}

      {publishResultsOpen && quizId && (
        <PublishResultsModal
          quizId={quizId}
          quizType={quiz.quizType}
          onClose={() => setPublishResultsOpen(false)}
          onPublished={refetch}
        />
      )}

      {unpublishResultsOpen && quizId && (
        <ConfirmDialog
          title="Unpublish results?"
          message={
            <div className="space-y-2">
              <p>Guardians will no longer be able to see this quiz's results.</p>
              <p>
                Any score already written to a student's midterm quiz score is <span className="font-medium">not</span>{" "}
                reverted - it stays until a later save on the score sheet, or a republish, overwrites it.
              </p>
            </div>
          }
          confirmLabel="Unpublish results"
          variant="danger"
          onConfirm={async () => {
            await unpublishTakeHomeQuizResults(quizId);
            refetch();
          }}
          onClose={() => setUnpublishResultsOpen(false)}
        />
      )}
    </div>
  );
}
