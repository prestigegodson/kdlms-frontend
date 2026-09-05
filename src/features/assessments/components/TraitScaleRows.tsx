import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export interface TraitScaleRow {
  /** `undefined` for a freshly authored option not yet saved - carried through untouched so the backend can tell an edit from a replacement. */
  id?: string;
  value: string;
  label: string;
  description: string;
}

interface TraitScaleRowsProps {
  options: TraitScaleRow[];
  onChange: (options: TraitScaleRow[]) => void;
}

const BLANK_OPTION: TraitScaleRow = { value: "", label: "", description: "" };

/**
 * The ordered rating-scale editor for one behavioural-trait category -
 * copies `RatingScaleRows`' add/remove/up-down shape verbatim (order
 * carries meaning, rank 1 is the lowest rating, so rows reorder via arrows
 * rather than free drag) but adds a short **Value** field - the mark
 * printed on the report (e.g. "1".."5") - alongside the Label, since a
 * school may edit both independently. Unlike a `GradingSystem`'s rating
 * scale, editing an existing row here is a true in-place update: its `id`
 * rides along unchanged, so relabelling or re-valuing an already-rated
 * option never loses the students already rated against it.
 */
export function TraitScaleRows({ options, onChange }: TraitScaleRowsProps) {
  function updateRow(index: number, patch: Partial<TraitScaleRow>) {
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
            key={option.id ?? `new-${index}`}
            className="flex flex-col gap-3 rounded-control border border-slate-200 p-3 sm:flex-row sm:items-end"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
              {index + 1}
            </span>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[5rem_1fr_1fr]">
              <FormField label="Value" htmlFor={`trait-scale-${index}-value`}>
                <Input
                  id={`trait-scale-${index}-value`}
                  required
                  value={option.value}
                  onChange={(event) => updateRow(index, { value: event.target.value })}
                />
              </FormField>
              <FormField label="Label" htmlFor={`trait-scale-${index}-label`}>
                <Input
                  id={`trait-scale-${index}-label`}
                  required
                  value={option.label}
                  onChange={(event) => updateRow(index, { label: event.target.value })}
                />
              </FormField>
              <FormField label="Description (optional)" htmlFor={`trait-scale-${index}-description`}>
                <Input
                  id={`trait-scale-${index}-description`}
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
