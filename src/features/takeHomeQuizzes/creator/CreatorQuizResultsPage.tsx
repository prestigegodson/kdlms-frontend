import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
import {
  adjustLearnerQuizScore,
  type ClassQuizResultsView,
  type ClassQuizView,
  clearLearnerQuizScoreAdjustment,
  getClassQuiz,
  getClassQuizResults,
  getLearnerQuizResult,
  type LearnerResultRowView,
  resetLearnerQuizAttempt,
  unpublishClassQuizResults,
} from "@/api/classTakeHomeQuizzes";
import type { StudentResultRowView } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { AdjustScoreModal } from "@/features/takeHomeQuizzes/components/AdjustScoreModal";
import { ResultsTable } from "@/features/takeHomeQuizzes/components/ResultsTable";
import { StudentAnswersModal } from "@/features/takeHomeQuizzes/components/StudentAnswersModal";
import { CreatorPublishResultsModal } from "@/features/takeHomeQuizzes/creator/CreatorPublishResultsModal";
import { quizStatusLabel, quizStatusVariant } from "@/features/takeHomeQuizzes/takeHomeQuizStatus";

/**
 * The shared `ResultsTable` is keyed on school students; a learner row maps onto it with the
 * learner id in `studentId` and an over-limit note where the admission number would sit.
 */
function toTableRow(row: LearnerResultRowView): StudentResultRowView {
  return {
    ...row,
    studentId: row.learnerId,
    admissionNumber: row.overLimit ? "Beyond your plan's class size" : "",
  };
}

/**
 * A creator's results for one class quiz (creators Phase C13) at
 * `/creator/quizzes/:classId/:quizId/results`: every member's attempt, their answers, score
 * adjustments and resets, and publishing results - the school `TakeHomeQuizResultsPage` without the
 * midterm write-back. The creator is the class's only teacher, so every action is theirs while the
 * class is writable.
 */
export function CreatorQuizResultsPage() {
  const { classId = "", quizId = "" } = useParams<{ classId: string; quizId: string }>();

  const [quiz, setQuiz] = useState<ClassQuizView | null>(null);
  const [results, setResults] = useState<ClassQuizResultsView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [answersTarget, setAnswersTarget] = useState<StudentResultRowView | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<StudentResultRowView | null>(null);
  const [resetTarget, setResetTarget] = useState<StudentResultRowView | null>(null);
  const [publishResultsOpen, setPublishResultsOpen] = useState(false);
  const [unpublishResultsOpen, setUnpublishResultsOpen] = useState(false);

  const load = useCallback(() => {
    Promise.all([getClassQuiz(classId, quizId), getClassQuizResults(classId, quizId)])
      .then(([quizView, resultsView]) => {
        setQuiz(quizView);
        setResults(resultsView);
      })
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err.message : "Failed to load results"));
  }, [classId, quizId]);

  useEffect(() => {
    load();
  }, [load, reloadToken]);

  function refetch() {
    setReloadToken((token) => token + 1);
  }

  async function handleClearAdjustment(row: StudentResultRowView) {
    setActionError(null);
    try {
      await clearLearnerQuizScoreAdjustment(classId, quizId, row.studentId);
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

  // Score changes are writes, so they follow the class's own writability (`canEditMetadata`).
  const writable = quiz.actions.canEditMetadata;

  return (
    <div className="space-y-6">
      <PageHeader
        title={quiz.title}
        description={`${quiz.className} · ${results.totalPoints} points`}
        backTo={`/creator/quizzes/${classId}/${quiz.id}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {quiz.actions.canPublishResults && quiz.status === "PUBLISHED" && (
              <Button variant="accent" onClick={() => setPublishResultsOpen(true)}>
                Publish results
              </Button>
            )}
            {quiz.actions.canUnpublishResults && (
              <Button variant="secondary" onClick={() => setUnpublishResultsOpen(true)}>
                Unpublish results
              </Button>
            )}
          </div>
        }
      />

      {actionError && <Alert variant="error">{actionError}</Alert>}

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Badge variant={quizStatusVariant(quiz.status, quiz.availability)}>
          {quizStatusLabel(quiz.status, quiz.availability)}
        </Badge>
        <span>
          {results.submittedCount || 0} of {results.rosterSize} learners submitted
        </span>
      </div>

      {results.rows.length === 0 ? (
        <EmptyState title="No learners in this class yet" />
      ) : (
        <ResultsTable
          rows={results.rows.map(toTableRow)}
          totalPoints={results.totalPoints}
          participantLabel="Learner"
          canAdjust={writable}
          canReset={writable}
          onViewAnswers={setAnswersTarget}
          onAdjust={setAdjustTarget}
          onClearAdjustment={handleClearAdjustment}
          onReset={setResetTarget}
        />
      )}

      {answersTarget && (
        <StudentAnswersModal
          quizId={quizId}
          studentId={answersTarget.studentId}
          studentName={answersTarget.fullName}
          load={() => getLearnerQuizResult(classId, quizId, answersTarget.studentId)}
          onClose={() => setAnswersTarget(null)}
        />
      )}

      {adjustTarget && (
        <AdjustScoreModal
          quizId={quizId}
          studentId={adjustTarget.studentId}
          studentName={adjustTarget.fullName}
          currentScore={adjustTarget.effectiveScore}
          totalPoints={results.totalPoints}
          adjust={(request) => adjustLearnerQuizScore(classId, quizId, adjustTarget.studentId, request)}
          onClose={() => setAdjustTarget(null)}
          onAdjusted={() => {
            setAdjustTarget(null);
            refetch();
          }}
        />
      )}

      {resetTarget && (
        <ConfirmDialog
          title={`Reset ${resetTarget.fullName}'s attempt?`}
          message={
            <div className="space-y-2">
              <p>This clears their saved answers, score, submission and start time.</p>
              <p>
                While the quiz is open they can start again with the full time. Past score adjustments stay in the
                audit trail.
              </p>
            </div>
          }
          confirmLabel="Reset attempt"
          variant="danger"
          onConfirm={async () => {
            await resetLearnerQuizAttempt(classId, quizId, resetTarget.studentId);
            setResetTarget(null);
            refetch();
          }}
          onClose={() => setResetTarget(null)}
        />
      )}

      {publishResultsOpen && (
        <CreatorPublishResultsModal
          classId={classId}
          quizId={quizId}
          onClose={() => setPublishResultsOpen(false)}
          onPublished={refetch}
        />
      )}

      {unpublishResultsOpen && (
        <ConfirmDialog
          title="Unpublish results?"
          message="Learners and guardians will no longer see their scores for this quiz, unless it shows results on submit."
          confirmLabel="Unpublish results"
          variant="danger"
          onConfirm={async () => {
            await unpublishClassQuizResults(classId, quizId);
            setUnpublishResultsOpen(false);
            refetch();
          }}
          onClose={() => setUnpublishResultsOpen(false)}
        />
      )}
    </div>
  );
}
