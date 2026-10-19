import { type ReactNode } from "react";
import { Check, ListChecks } from "lucide-react";
import {
  type PublicAnswerView,
  type PublicOptionView,
  type PublicQuestionView,
} from "@/api/publicTakeHomeQuiz";
import { RichContent } from "@/components/richText/RichContent";
import { Input } from "@/components/ui/Input";
import { pluginFor } from "@/features/takeHomeQuizzes/interactions/registry";

interface QuestionCardProps {
  question: PublicQuestionView;
  answer: PublicAnswerView | undefined;
  answered: boolean;
  onChange: (answer: PublicAnswerView) => void;
  /**
   * Renders one embedded image by its `data-file-id` (Phase 35I - was a bare `token: string` prop
   * that built a public `<img src>` directly). Now a render-prop so the portal transport can
   * fetch through its own authenticated endpoint (`useObjectUrl`, the `AuthenticatedRichImage`
   * shape) while the public transport still passes a plain `<img src={publicQuestionImageUrl(...)}>` -
   * the portal's image endpoint needs a Bearer header a bare `<img src>` can't carry. `size`
   * preserves the prompt-vs-option sizing this component always applied (max-h-60 vs max-h-32);
   * the transport's own `<img>`/component is expected to size itself to fill its container.
   */
  renderImage: (fileId: string, alt: string, size: "prompt" | "option") => ReactNode;
  /** A passage is on screen alongside the question, so options always go one per line - never 2-up. */
  stackOptions?: boolean;
}

/** Short enough to sit two-up on a wider screen without wrapping awkwardly. */
const SHORT_OPTION_MAX_CHARS = 28;
const GRID_MAX_OPTIONS = 4;

/**
 * Lays options out 2x2 only when every one is short plain text - an image
 * or a long sentence reads better full-width.
 */
function allOptionsShort(options: PublicOptionView[]): boolean {
  if (options.length > GRID_MAX_OPTIONS) {
    return false;
  }
  const parser = new DOMParser();
  return options.every((option) => {
    if (option.label.includes("<img")) {
      return false;
    }
    const text = parser.parseFromString(option.label, "text/html").body.textContent ?? "";
    return text.trim().length <= SHORT_OPTION_MAX_CHARS;
  });
}

/**
 * One question, one screen (Phase 20D's "poor connectivity / mobile"
 * design rule - a long scroll is unusable on a phone and makes an
 * accidental submit likelier). Each option is a big tappable card wrapping
 * a visually hidden native radio/checkbox, so the whole card selects it
 * while screen readers, keyboard arrows/space, and form semantics still
 * work. Selection is never colour-only: the letter badge turns into a tick.
 */
export function QuestionCard({ question, answer, answered, onChange, renderImage, stackOptions = false }: QuestionCardProps) {
  const selected = new Set(answer?.selectedOptionIds ?? []);
  const multi = question.questionType === "MULTI_CHOICE";
  const choice = multi || question.questionType === "SINGLE_CHOICE";
  const grid = !stackOptions && choice && allOptionsShort(question.options);
  const plugin = question.playerConfig ? pluginFor(question.questionType) : undefined;

  function renderOptionImage(fallbackAlt: string) {
    return (fileId: string, alt: string) => renderImage(fileId, alt || fallbackAlt, "option");
  }

  function toggle(optionId: string, checked: boolean) {
    if (!multi) {
      onChange({ selectedOptionIds: [optionId], textAnswer: null });
      return;
    }
    const next = new Set(selected);
    if (checked) {
      next.add(optionId);
    } else {
      next.delete(optionId);
    }
    onChange({ selectedOptionIds: Array.from(next), textAnswer: null });
  }

  return (
    <fieldset className="rounded-card border border-slate-200 bg-white p-4 sm:p-6">
      <legend className="float-left flex w-full items-start justify-between gap-3 text-left">
        <span className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 font-display text-base font-semibold text-white mb-2"
            aria-hidden="true"
          >
            {question.position}
          </span>
          <span className="sr-only">Question {question.position}:</span>
          <RichContent
            html={question.prompt}
            renderImage={(fileId, alt) => renderImage(fileId, alt, "prompt")}
            className="min-w-0 space-y-2 break-words pt-1 font-display text-lg font-semibold text-slate-900"
          />
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-1.5 text-xs font-medium text-slate-500">
          {answered && <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />}
          {question.points} {question.points === 1 ? "point" : "points"}
        </span>
      </legend>

      {multi && (
        <p className="clear-both flex items-center gap-1.5 pt-3 text-sm font-medium text-brand-600">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          Pick all that apply
        </p>
      )}

      {choice && (
        <div
          data-testid="question-options"
          className={`clear-both mt-4 ${grid ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}`}
        >
          {question.options.map((option, index) => {
            const isSelected = selected.has(option.id);
            return (
              <label
                key={option.id}
                className="flex min-h-14 cursor-pointer select-none items-center gap-3 rounded-card border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 transition-colors hover:border-brand-200 hover:bg-brand-50/60 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:font-semibold has-[:checked]:text-brand-800 has-[:checked]:shadow-md has-[:checked]:ring-2 has-[:checked]:ring-brand-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-400 sm:text-lg"
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={`question-${question.id}`}
                  className="sr-only"
                  checked={isSelected}
                  onChange={(event) => toggle(option.id, event.target.checked)}
                />
                <span
                  key={isSelected ? "on" : "off"}
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center font-display text-base font-bold ${
                    multi ? "rounded-lg" : "rounded-full"
                  } ${isSelected ? "quiz-option-pop bg-brand-500 text-white" : "bg-brand-100 text-brand-600"}`}
                >
                  {isSelected ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : (
                    String.fromCharCode(65 + index)
                  )}
                </span>
                <RichContent
                  html={option.label}
                  renderImage={renderOptionImage(`Option ${index + 1}`)}
                  className="min-w-0 break-words"
                />
              </label>
            );
          })}
        </div>
      )}

      {plugin && (
        <div className="clear-both pt-4">
          <plugin.Player
            config={question.playerConfig}
            value={answer?.interaction ?? null}
            onChange={(response: object) =>
              onChange({ selectedOptionIds: [], textAnswer: null, interaction: response })
            }
            disabled={false}
            renderImage={(fileId: string, alt: string) => renderImage(fileId, alt, "option")}
          />
        </div>
      )}

      {question.questionType === "FILL_IN_THE_GAP" && (
        <div className="clear-both mt-4">
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
    </fieldset>
  );
}
