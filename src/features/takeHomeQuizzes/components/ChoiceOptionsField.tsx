import { Plus, X } from "lucide-react";
import type { QuestionType } from "@/api/takeHomeQuizzes";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import type { EditableOption } from "@/features/takeHomeQuizzes/editableQuestion";

interface ChoiceOptionsFieldProps {
  questionType: Extract<QuestionType, "SINGLE_CHOICE" | "MULTI_CHOICE">;
  options: EditableOption[];
  onChange: (options: EditableOption[]) => void;
  /** A stable per-question identifier so SINGLE_CHOICE's native radio group stays mutually exclusive - the question's own `key`, not derived from its (mutable) option list. */
  groupName: string;
  disabled?: boolean;
}

/**
 * The option list for a `SINGLE_CHOICE`/`MULTI_CHOICE` question - a radio
 * group or a checkbox group depending on `questionType`, so exactly one (or
 * at least one) option can be marked correct. Rows are keyed by `key`
 * (server id for an existing option, a generated local uid for one added
 * in this editing session), never by index - these rows have stable
 * server identity under `ManageTakeHomeQuizzesUseCase`'s id-preservation
 * rule, unlike `PresentationStepsField`'s purely positional rows.
 */
export function ChoiceOptionsField({
  questionType,
  options,
  onChange,
  groupName,
  disabled = false,
}: ChoiceOptionsFieldProps) {
  const inputType = questionType === "SINGLE_CHOICE" ? "radio" : "checkbox";

  function updateAt(index: number, patch: Partial<EditableOption>) {
    const next = options.map((option, i) => (i === index ? { ...option, ...patch } : option));
    onChange(next);
  }

  function toggleCorrect(index: number, checked: boolean) {
    if (questionType === "SINGLE_CHOICE") {
      onChange(options.map((option, i) => ({ ...option, correct: i === index && checked })));
      return;
    }
    updateAt(index, { correct: checked });
  }

  function removeAt(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function addOption() {
    onChange([...options, { key: crypto.randomUUID(), id: null, label: "", correct: false }]);
  }

  return (
    <FormField label="Options">
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={option.key} className="flex items-center gap-2">
            <input
              type={inputType}
              name={questionType === "SINGLE_CHOICE" ? `correct-option-${groupName}` : undefined}
              aria-label={`Option ${index + 1} is correct`}
              checked={option.correct}
              onChange={(event) => toggleCorrect(index, event.target.checked)}
              disabled={disabled}
              className="h-4 w-4 shrink-0 border-slate-300 text-brand-500"
            />
            <Input
              aria-label={`Option ${index + 1} label`}
              placeholder={`Option ${index + 1}`}
              value={option.label}
              onChange={(event) => updateAt(index, { label: event.target.value })}
              disabled={disabled}
              className="flex-1"
            />
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove option ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
        {!disabled && (
          <Button type="button" variant="secondary" size="sm" onClick={addOption}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add option
          </Button>
        )}
      </div>
    </FormField>
  );
}
