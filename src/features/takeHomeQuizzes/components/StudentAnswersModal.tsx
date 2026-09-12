import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getStudentTakeHomeQuizResult, type StudentAttemptDetailView } from "@/api/takeHomeQuizzes";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { RichContent } from "@/components/richText/RichContent";
import { Check, X } from "lucide-react";

interface StudentAnswersModalProps {
  quizId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

/**
 * A teacher's per-question breakdown of one student's attempt (Phase 20E) -
 * the staff, answer-key-carrying counterpart to the anonymous quiz-taking
 * `QuestionCard`, which never shows what's correct. `size="xl"` since a
 * quiz's full question set is dense content.
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
        <div className="space-y-6">
          {detail.questions.map((question) => (
            <div key={question.questionId} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-medium text-slate-900">
                  <span className="block text-xs font-normal text-slate-500">Question {question.position}</span>
                  <RichContent
                    html={question.prompt}
                    renderImage={(fileId, alt) => <AuthenticatedRichImage fileId={fileId} alt={alt} />}
                  />
                </div>
                <span className="shrink-0 text-sm text-slate-500">
                  {question.awardedPoints ?? 0} / {question.points} pts
                </span>
              </div>

              {question.questionType !== "FILL_IN_THE_GAP" && (
                <ul className="space-y-1 text-sm">
                  {question.options.map((option) => {
                    const selected = question.selectedOptionIds.includes(option.id);
                    return (
                      <li
                        key={option.id}
                        className={`flex items-start gap-2 rounded-control border px-3 py-1.5 ${
                          option.correct
                            ? "border-green-300 bg-green-50"
                            : selected
                              ? "border-red-300 bg-red-50"
                              : "border-slate-200"
                        }`}
                      >
                        {option.correct ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
                        ) : selected ? (
                          <X className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                        ) : (
                          <span className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <RichContent
                          html={option.label}
                          renderImage={(fileId, alt) => <AuthenticatedRichImage fileId={fileId} alt={alt} />}
                          className="min-w-0"
                        />
                        {selected && <span className="ml-auto text-xs text-slate-500">Selected</span>}
                      </li>
                    );
                  })}
                </ul>
              )}

              {question.questionType === "FILL_IN_THE_GAP" && (
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-slate-500">Student's answer: </span>
                    {question.textAnswer ? question.textAnswer : <span className="text-slate-400">No answer</span>}
                  </p>
                  <p>
                    <span className="text-slate-500">Accepted answer: </span>
                    {question.answerKeys.map((key) => key.expectedAnswer).join(" / ")}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
