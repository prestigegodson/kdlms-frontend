import type { ReactNode } from "react";
import type { QuestionType } from "@/api/takeHomeQuizzes";
import { RichContent } from "@/components/richText/RichContent";
import { Check, X } from "lucide-react";

export interface QuizReviewOption {
  id: string;
  label: string;
  correct: boolean;
}

export interface QuizReviewQuestion {
  id: string;
  position: number;
  questionType: QuestionType;
  prompt: string;
  points: number;
  options: QuizReviewOption[];
  /** Correct answer text for a FILL_IN_THE_GAP question - empty for a choice question. */
  acceptedAnswers: string[];
  selectedOptionIds: string[];
  textAnswer: string | null;
  awardedPoints: number | null;
}

interface QuizReviewProps {
  questions: QuizReviewQuestion[];
  renderImage: (fileId: string, alt: string) => ReactNode;
  /** "staff" (default) reads "Student's answer"; "self" reads "Your answer", for a student's own reveal-on-submit review. */
  perspective?: "staff" | "self";
}

/**
 * A per-question breakdown of one attempt, answer key included - shared by the teacher's
 * `StudentAnswersModal` and a student's own reveal-on-submit review (Phase 20K, both the token
 * and portal paths), so the three surfaces can never render this differently. Extracted from
 * `StudentAnswersModal`, which originally owned this rendering alone.
 */
export function QuizReview({ questions, renderImage, perspective = "staff" }: QuizReviewProps) {
  const answerLabel = perspective === "self" ? "Your answer: " : "Student's answer: ";
  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <div key={question.id} className="space-y-2 border-b border-slate-100 pb-4 last:border-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 font-medium text-slate-900">
              <span className="block text-xs font-normal text-slate-500">Question {question.position}</span>
              <RichContent html={question.prompt} renderImage={renderImage} />
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
                    <RichContent html={option.label} renderImage={renderImage} className="min-w-0" />
                    {selected && <span className="ml-auto text-xs text-slate-500">Selected</span>}
                  </li>
                );
              })}
            </ul>
          )}

          {question.questionType === "FILL_IN_THE_GAP" && (
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-slate-500">{answerLabel}</span>
                {question.textAnswer ? question.textAnswer : <span className="text-slate-400">No answer</span>}
              </p>
              <p>
                <span className="text-slate-500">Accepted answer: </span>
                {question.acceptedAnswers.join(" / ")}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
