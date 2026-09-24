import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getStudentTakeHomeQuizResult, type StudentAttemptDetailView } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { QuizReview } from "@/features/takeHomeQuizzes/components/QuizReview";

interface StudentAnswersModalProps {
  quizId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

function toReviewQuestions(detail: StudentAttemptDetailView) {
  return detail.questions.map((question) => ({
    id: question.questionId,
    position: question.position,
    questionType: question.questionType,
    prompt: question.prompt,
    points: question.points,
    options: question.options,
    acceptedAnswers: question.answerKeys.map((key) => key.expectedAnswer),
    selectedOptionIds: question.selectedOptionIds,
    textAnswer: question.textAnswer,
    awardedPoints: question.awardedPoints,
  }));
}

/**
 * A teacher's per-question breakdown of one student's attempt (Phase 20E) -
 * the staff, answer-key-carrying counterpart to the anonymous quiz-taking
 * `QuestionCard`, which never shows what's correct. `size="xl"` since a
 * quiz's full question set is dense content. Renders via the shared
 * `QuizReview` (Phase 20K), also used by a student's own reveal-on-submit
 * review, so the two can never drift apart.
 */
export function StudentAnswersModal({ quizId, studentId, studentName, onClose }: StudentAnswersModalProps) {
  const [detail, setDetail] = useState<StudentAttemptDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStudentTakeHomeQuizResult(quizId, studentId)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load this attempt"));
  }, [quizId, studentId]);

  return (
    <Modal open onClose={onClose} title={`${studentName}'s answers`} size="xl">
      {error && <Alert variant="error">{error}</Alert>}
      {!error && !detail && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {detail && (
        <QuizReview
          questions={toReviewQuestions(detail)}
          renderImage={(fileId, alt) => <AuthenticatedRichImage fileId={fileId} alt={alt} />}
        />
      )}
    </Modal>
  );
}
