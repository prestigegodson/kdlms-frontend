import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

interface StringListFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Passed straight through to the `FormField` this component owns internally. */
  description?: ReactNode;
}

/**
 * A small repeatable-row list of plain text values - objectives,
 * instructional materials, references. Deliberately not a generic
 * list-builder abstraction (per lesson-notes-plan.md's guidance): it only
 * knows about a flat string per row. Blank rows are filtered out at save
 * time by the editor page, not here, so a user can freely add a row and
 * type into it without the list re-indexing under them.
 * <p>
 * Editable only - `LessonNoteEditorPage` swaps to `LessonNoteReadView`
 * entirely for its read-only/preview render (it renders maths via
 * `MathText` and prose formatting this component never had), rather than
 * this component growing a second, divergent read-only branch of its own.
 */
export function StringListField({
  label,
  values,
  onChange,
  placeholder,
  description,
}: StringListFieldProps) {
  function updateAt(index: number, value: string) {
    const next = [...values];
    next[index] = value;
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <FormField label={label} description={description}>
      <div className="space-y-2">
        {values.map((value, index) => (
          // Rows have no stable identity of their own; index is fine for a purely positional list.
          <div key={index} className="flex items-center gap-2">
            <Input
              value={value}
              placeholder={placeholder}
              onChange={(event) => updateAt(index, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove ${label.toLowerCase()} item ${index + 1}`}
              onClick={() => removeAt(index)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...values, ""])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add
        </Button>
      </div>
    </FormField>
  );
}
