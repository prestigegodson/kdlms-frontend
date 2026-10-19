import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { QuizQuestionStats } from "@/api/takeHomeQuizzes";
import { AuthenticatedRichImage } from "@/components/richText/AuthenticatedRichImage";
import { RichContent } from "@/components/richText/RichContent";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { QUESTION_TYPE_LABELS } from "@/features/takeHomeQuizzes/editableQuestion";
import { PartBreakdown } from "@/features/takeHomeQuizzes/components/analytics/PartBreakdown";
import { isInteractive } from "@/features/takeHomeQuizzes/interactions/registry";

/** Below 40% correct is hard, below 70% moderate - the bar's colour only, never a stored judgement. */
function difficultyClass(percent: number | null): string {
  if (percent == null) return "bg-slate-300";
  if (percent < 40) return "bg-red-500";
  if (percent < 70) return "bg-amber-500";
  return "bg-green-500";
}

function renderImage(fileId: string, alt: string) {
  return <AuthenticatedRichImage fileId={fileId} alt={alt} />;
}

interface QuestionAnalysisTableProps {
  /** Already ordered hardest first by the server. */
  questions: QuizQuestionStats[];
}

/** Per-question difficulty, hardest first; expanding a question shows how its options were picked or its common wrong answers. */
export function QuestionAnalysisTable({ questions }: QuestionAnalysisTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Card className="p-0 sm:p-0">
      <div className="border-b border-slate-200 p-4 sm:px-6">
        <h3 className="font-display text-base font-medium text-slate-900">
          Questions, hardest first
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Ranked by the average share of each question's points earned in submitted attempts - for
          a question without partial credit, the share that got it right. Open a question to see
          its answers.
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {questions.map((question) => {
          const open = expanded === question.questionId;
          const interactive = isInteractive(question.questionType);
          const percent = question.averagePercent ?? question.correctPercent;
          return (
            <li key={question.questionId}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : question.questionId)}
                className="flex w-full cursor-pointer items-start gap-3 p-4 text-left hover:bg-slate-50 sm:px-6"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">Question {question.position}</span>
                    <span>{QUESTION_TYPE_LABELS[question.questionType]}</span>
                    <span>· {question.points} pts</span>
                    {question.distractorFlag && <Badge variant="warning">Check answer key</Badge>}
                  </div>
                  <div className="line-clamp-2 text-sm text-slate-900">
                    <RichContent html={question.prompt} renderImage={renderImage} className="space-y-2" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${difficultyClass(percent)}`}
                        style={{ width: `${percent ?? 0}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-xs tabular-nums text-slate-600">
                      {percent == null
                        ? "No submissions"
                        : interactive
                          ? `${percent}% average`
                          : `${percent}% correct`}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  aria-hidden="true"
                  className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>
              {open && <QuestionDetail question={question} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function QuestionDetail({ question }: { question: QuizQuestionStats }) {
  return (
    <div className="space-y-4 bg-slate-50 px-4 pb-4 pt-2 text-sm sm:px-6">
      <RichContent html={question.prompt} renderImage={renderImage} className="space-y-2" />
      <p className="text-xs text-slate-500">
        {question.correctCount} correct · {question.answeredCount} answered · average{" "}
        {question.averagePoints ?? 0} of {question.points} pts
      </p>

      {isInteractive(question.questionType) ? (
        <PartBreakdown questionType={question.questionType} parts={question.parts ?? []} />
      ) : question.questionType === "FILL_IN_THE_GAP" ? (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Common wrong answers
          </h4>
          {question.commonWrongAnswers.length === 0 ? (
            <p className="mt-2 text-slate-500">No wrong answers.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {question.commonWrongAnswers.map((wrong) => (
                <li key={wrong.answer} className="flex justify-between gap-4">
                  <span className="min-w-0 break-words text-slate-800">“{wrong.answer}”</span>
                  <span className="shrink-0 tabular-nums text-slate-500">{wrong.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            How options were picked
          </h4>
          {question.distractorFlag && (
            <p className="mt-1 text-xs text-amber-700">
              A wrong option was picked more often than the correct one - check the answer key and
              the wording.
            </p>
          )}
          <ul className="mt-2 space-y-2">
            {question.options.map((option) => (
              <li key={option.optionId} className="space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-1.5">
                    {option.correct && (
                      <Check
                        aria-label="Correct option"
                        className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                      />
                    )}
                    <RichContent
                      html={option.label}
                      renderImage={renderImage}
                      className="min-w-0"
                    />
                  </div>
                  <span className="shrink-0 tabular-nums text-slate-500">
                    {option.pickedCount}
                    {option.pickedPercent != null && ` (${option.pickedPercent}%)`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${option.correct ? "bg-green-500" : "bg-slate-400"}`}
                    style={{ width: `${option.pickedPercent ?? 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
