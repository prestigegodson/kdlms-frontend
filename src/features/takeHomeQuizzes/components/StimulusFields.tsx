import { BookOpen, ChevronDown, ChevronUp, ListChecks, X } from "lucide-react";
import { useId, useState } from "react";
import type { StimulusKind } from "@/api/takeHomeQuizzes";
import { RichTextField } from "@/components/richText/RichTextField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { type EditableStimulus, STIMULUS_KIND_LABELS } from "@/features/takeHomeQuizzes/editableStimulus";

/** Mirrors backend `QuizStimulus.MAX_TITLE_LENGTH` / `QuizRichText.MAX_IMAGES_PER_STIMULUS`. */
const MAX_TITLE_LENGTH = 200;
const MAX_IMAGES_PER_STIMULUS = 20;

const KIND_HINTS: Record<StimulusKind, string> = {
  PASSAGE: "A text students read to answer the questions below - shown beside each question on a wide screen.",
  INSTRUCTION: "A short direction shared by the questions below, e.g. “Choose TRUE, FALSE or NOT GIVEN.”",
};

interface StimulusSectionHeaderProps {
  stimulus: EditableStimulus;
  /** "Passage 2" - numbered among its own kind. */
  name: string;
  /** "Questions 3-7", or null while it has none. */
  range: string | null;
  questionCount: number;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onChange: (patch: Partial<EditableStimulus>) => void;
  onRemove: (keepQuestions: boolean) => void;
}

/**
 * A passage or group instruction's own card at the top of its section (quiz-module.md Phase 20L):
 * kind, optional title, the rich-text body, and the passage-only paragraph-labels switch. The body
 * collapses behind "Hide text" so a teacher on a phone can work through a long passage's questions
 * without scrolling past it every time. Removing asks, inline, whether its questions stay.
 */
export function StimulusSectionHeader({
  stimulus,
  name,
  range,
  questionCount,
  disabled,
  canMoveUp,
  canMoveDown,
  onMove,
  onChange,
  onRemove,
}: StimulusSectionHeaderProps) {
  // A brand-new passage opens for writing; a saved one starts collapsed so its questions are in view.
  const [open, setOpen] = useState(stimulus.id === null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const bodyId = useId();
  const Icon = stimulus.kind === "PASSAGE" ? BookOpen : ListChecks;

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-2 text-left"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block font-display text-sm font-medium text-slate-900">
              {name}
              {stimulus.title.trim() && <span className="font-normal text-slate-600"> - {stimulus.title.trim()}</span>}
            </span>
            <span className="block text-xs text-slate-500">
              {range ?? "No questions yet"} {open ? "· Hide text" : "· Show text"}
            </span>
          </span>
          <ChevronDown
            className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {!disabled && (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Move ${name.toLowerCase()} up`}
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Move ${name.toLowerCase()} down`}
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${name.toLowerCase()}`}
              onClick={() => (questionCount === 0 ? onRemove(false) : setConfirmingRemove(true))}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {confirmingRemove && (
        <div role="group" aria-label={`Remove ${name.toLowerCase()}`} className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-700">
            Remove {name.toLowerCase()}? Its {questionCount === 1 ? "question" : `${questionCount} questions`} can stay
            as standalone {questionCount === 1 ? "question" : "questions"} or go with it.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => onRemove(true)}>
              Keep the questions
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={() => onRemove(false)}>
              Remove the questions too
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingRemove(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div id={bodyId} className={open ? "space-y-4" : "hidden"}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Type</legend>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label={`${name} type`}>
            {(Object.keys(STIMULUS_KIND_LABELS) as StimulusKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={stimulus.kind === kind}
                disabled={disabled}
                onClick={() => onChange({ kind, paragraphLabels: kind === "PASSAGE" && stimulus.paragraphLabels })}
                className={`min-h-11 rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50 ${
                  stimulus.kind === kind ? "bg-brand-500 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {STIMULUS_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{KIND_HINTS[stimulus.kind]}</p>
        </fieldset>

        <FormField label="Title (optional)" htmlFor={`stimulus-title-${stimulus.key}`}>
          <Input
            id={`stimulus-title-${stimulus.key}`}
            value={stimulus.title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder={stimulus.kind === "PASSAGE" ? "e.g. The Life of Bees" : "e.g. Questions on the chart"}
            onChange={(event) => onChange({ title: event.target.value })}
            disabled={disabled}
          />
        </FormField>

        <FormField label={stimulus.kind === "PASSAGE" ? "Passage" : "Instruction"} htmlFor={`stimulus-body-${stimulus.key}`}>
          <RichTextField
            id={`stimulus-body-${stimulus.key}`}
            value={stimulus.body}
            onChange={(body) => onChange({ body })}
            allowImages
            maxImages={MAX_IMAGES_PER_STIMULUS}
            disabled={disabled}
            ariaLabel={`${name} text`}
          />
        </FormField>

        {stimulus.kind === "PASSAGE" && (
          <Switch
            checked={stimulus.paragraphLabels}
            onChange={(paragraphLabels) => onChange({ paragraphLabels })}
            label="Label paragraphs A, B, C"
            hint="For questions like “Which paragraph contains…”"
            disabled={disabled}
          />
        )}
      </div>
    </Card>
  );
}
