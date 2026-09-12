import { Check } from "lucide-react";
import { publicQuestionImageUrl, type PublicAnswerView, type PublicQuestionView } from "@/api/publicTakeHomeQuiz";
import { RichContent } from "@/components/richText/RichContent";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";

interface QuestionCardProps {
  /** The student's own tokenised link - threaded down only to build a question image's `<img src>` (`publicQuestionImageUrl`); never sent anywhere else from this component. */
  token: string;
  question: PublicQuestionView;
  answer: PublicAnswerView | undefined;
  answered: boolean;
  onChange: (answer: PublicAnswerView) => void;
}

/**
 * One question, one screen (Phase 20D's "poor connectivity / mobile"
 * design rule - a long scroll is unusable on a phone and makes an
 * accidental submit likelier). Every input is a real native radio,
 * checkbox, or text field inside a `fieldset`/`legend` - no custom
 * widgets, so screen readers and browser autofill both work, and colour is
 * never the only signal for answered/unanswered (the checkmark carries it
 * too).
 */
export function QuestionCard({ token, question, answer, answered, onChange }: QuestionCardProps) {
  const selected = new Set(answer?.selectedOptionIds ?? []);

  function renderOptionImage(fallbackAlt: string) {
    return (fileId: string, alt: string) => (
      <img
        src={publicQuestionImageUrl(token, fileId)}
        alt={alt || fallbackAlt}
        loading="lazy"
        className="my-1 max-h-32 rounded-control border border-slate-200"
      />
    );
  }

  return (
    <fieldset className="rounded-panel border border-slate-200 bg-white p-4 sm:p-6">
      <legend className="float-left flex w-full items-start justify-between gap-3 text-left">
        <span className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 font-display text-sm font-semibold text-white mb-2"
            aria-hidden="true"
          >
            {question.position}
          </span>
          <span className="sr-only">Question {question.position}:</span>
          <RichContent
            html={question.prompt}
            renderImage={(fileId, alt) => (
              <img
                src={publicQuestionImageUrl(token, fileId)}
                alt={alt}
                loading="lazy"
                className="my-1 max-h-60 rounded-control border border-slate-200"
              />
            )}
            className="min-w-0 break-words font-display text-base font-semibold text-slate-900"
          />
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500">
          {answered && <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />}
          {question.points} {question.points === 1 ? "point" : "points"}
        </span>
      </legend>

      <div className="clear-both mt-4 space-y-2">
        {question.questionType === "SINGLE_CHOICE" &&
          question.options.map((option, index) => (
            <label
              key={option.id}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-slate-200 px-3 py-2 text-sm text-slate-900 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                className="mt-2.5 h-4 w-4 shrink-0 text-brand-500"
                checked={selected.has(option.id)}
                onChange={() => onChange({ selectedOptionIds: [option.id], textAnswer: null })}
              />
              <RichContent
                html={option.label}
                renderImage={renderOptionImage(`Option ${index + 1}`)}
                className="min-w-0"
              />
            </label>
          ))}

        {question.questionType === "MULTI_CHOICE" &&
          question.options.map((option, index) => (
            <label
              key={option.id}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control border border-slate-200 px-3 py-2 text-sm text-slate-900 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
            >
              <Checkbox
                checked={selected.has(option.id)}
                className="mt-2.5"
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) {
                    next.add(option.id);
                  } else {
                    next.delete(option.id);
                  }
                  onChange({ selectedOptionIds: Array.from(next), textAnswer: null });
                }}
              />
              <RichContent
                html={option.label}
                renderImage={renderOptionImage(`Option ${index + 1}`)}
                className="min-w-0"
              />
            </label>
          ))}

        {question.questionType === "FILL_IN_THE_GAP" && (
          <div>
            <label htmlFor={`question-${question.id}-answer`} className="sr-only">
              Your answer
            </label>
            <Input
              id={`question-${question.id}-answer`}
              value={answer?.textAnswer ?? ""}
              onChange={(event) => onChange({ selectedOptionIds: [], textAnswer: event.target.value })}
              placeholder="Type your answer"
              autoComplete="off"
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}
