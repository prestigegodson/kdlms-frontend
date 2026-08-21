import { Plus, X } from "lucide-react";
import type { PresentationStep } from "@/api/lessonNotes";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

interface PresentationStepsFieldProps {
  steps: PresentationStep[];
  onChange: (steps: PresentationStep[]) => void;
}

const EMPTY_STEP: PresentationStep = { label: "", teacherActivity: "", learnerActivity: "" };

/**
 * The presentation/development step table - each row is teacher activity vs. learner activity
 * for one labeled step. Editable only - `LessonNoteEditorPage` swaps to `LessonNoteReadView`
 * entirely for its read-only/preview render, rather than this component growing a second,
 * divergent read-only branch of its own.
 */
export function PresentationStepsField({ steps, onChange }: PresentationStepsFieldProps) {
  function updateAt(index: number, patch: Partial<PresentationStep>) {
    const next = steps.map((step, i) => (i === index ? { ...step, ...patch } : step));
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(steps.filter((_, i) => i !== index));
  }

  return (
    <FormField label="Presentation">
      <div className="space-y-4">
        {steps.map((step, index) => (
          // Rows have no stable identity of their own; index is fine for a purely positional list.
          <div
            key={index}
            className="grid gap-2 rounded-card border border-slate-200 p-3 sm:grid-cols-3"
          >
            <Input
              placeholder="Step label (e.g. Step 1)"
              value={step.label}
              onChange={(event) => updateAt(index, { label: event.target.value })}
            />
            <Input
              placeholder="Teacher activity"
              value={step.teacherActivity}
              onChange={(event) => updateAt(index, { teacherActivity: event.target.value })}
            />
            <div className="flex items-center gap-2">
              <Input
                placeholder="Learner activity"
                value={step.learnerActivity}
                onChange={(event) => updateAt(index, { learnerActivity: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove presentation step ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...steps, { ...EMPTY_STEP }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add step
        </Button>
      </div>
    </FormField>
  );
}
