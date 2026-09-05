import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

export interface TraitDefinitionRow {
  /** `undefined` for a freshly authored trait not yet saved. */
  id?: string;
  name: string;
  active: boolean;
}

interface TraitDefinitionRowsProps {
  traits: TraitDefinitionRow[];
  onChange: (traits: TraitDefinitionRow[]) => void;
}

const BLANK_TRAIT: TraitDefinitionRow = { name: "", active: true };

/**
 * The trait-list editor for one behavioural-trait category - mirrors
 * `TraitScaleRows`' add/remove/up-down shape. A trait already rated for a
 * student can't be removed (the backend refuses with a 422 naming it) - the
 * "Remove" button stays here regardless, since only the backend knows which
 * rows are in use; **Active** is the always-available soft-retire path: an
 * inactive trait drops off new entry sheets but stays intact for every term
 * already rated against it.
 */
export function TraitDefinitionRows({ traits, onChange }: TraitDefinitionRowsProps) {
  function updateRow(index: number, patch: Partial<TraitDefinitionRow>) {
    onChange(traits.map((trait, i) => (i === index ? { ...trait, ...patch } : trait)));
  }

  function addRow() {
    onChange([...traits, BLANK_TRAIT]);
  }

  function removeRow(index: number) {
    onChange(traits.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= traits.length) return;
    const reordered = [...traits];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Traits</h3>
        <button type="button" className="text-sm text-brand-500 hover:text-brand-600" onClick={addRow}>
          Add trait
        </button>
      </div>

      {traits.length === 0 && <p className="text-sm text-slate-500">No traits yet - add at least one.</p>}

      <ol className="space-y-3">
        {traits.map((trait, index) => (
          <li
            key={trait.id ?? `new-${index}`}
            className="flex flex-col gap-3 rounded-control border border-slate-200 p-3 sm:flex-row sm:items-end"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
              {index + 1}
            </span>
            <div className="flex-1">
              <FormField label="Name" htmlFor={`trait-${index}-name`}>
                <Input
                  id={`trait-${index}-name`}
                  required
                  value={trait.name}
                  onChange={(event) => updateRow(index, { name: event.target.value })}
                />
              </FormField>
            </div>
            <label className="flex shrink-0 items-center gap-2 pb-2 text-sm text-slate-700">
              <Checkbox checked={trait.active} onChange={(event) => updateRow(index, { active: event.target.checked })} />
              Active
            </label>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={`Move ${trait.name || "this trait"} up`}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Move ${trait.name || "this trait"} down`}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                disabled={index === traits.length - 1}
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
