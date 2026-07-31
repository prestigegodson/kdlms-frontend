import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export interface RatingScaleRow {
  label: string;
  description: string;
}

interface RatingScaleRowsProps {
  options: RatingScaleRow[];
  onChange: (options: RatingScaleRow[]) => void;
}

const BLANK_OPTION: RatingScaleRow = { label: "", description: "" };

/**
 * The ordered rating-scale editor for a QUALITATIVE grading system - order
 * carries meaning (rank 1 is the lowest rating), so rows reorder via
 * up/down arrows rather than free drag, matching LevelsPage's ranked-ladder
 * pattern. Rank itself isn't a field here - it's the row's position.
 */
export function RatingScaleRows({ options, onChange }: RatingScaleRowsProps) {
  function updateRow(index: number, patch: Partial<RatingScaleRow>) {
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  }

  function addRow() {
    onChange([...options, BLANK_OPTION]);
  }

  function removeRow(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= options.length) return;
    const reordered = [...options];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Rating scale</h3>
        <button type="button" className="text-sm text-brand-500 hover:text-brand-600" onClick={addRow}>
          Add rating
        </button>
      </div>

      {options.length === 0 && <p className="text-sm text-slate-500">No ratings yet - add at least two.</p>}

      <ol className="space-y-3">
        {options.map((option, index) => (
          <li
            key={index}
            className="flex flex-col gap-3 rounded-control border border-slate-200 p-3 sm:flex-row sm:items-end"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
              {index + 1}
            </span>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Label" htmlFor={`rating-${index}-label`}>
                <Input
                  id={`rating-${index}-label`}
                  required
                  value={option.label}
                  onChange={(event) => updateRow(index, { label: event.target.value })}
                />
              </FormField>
              <FormField label="Description (optional)" htmlFor={`rating-${index}-description`}>
                <Input
                  id={`rating-${index}-description`}
                  value={option.description}
                  onChange={(event) => updateRow(index, { description: event.target.value })}
                />
              </FormField>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Move ${option.label || "this rating"} up`}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Move ${option.label || "this rating"} down`}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                disabled={index === options.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => removeRow(index)}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
