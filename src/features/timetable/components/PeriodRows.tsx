import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type PeriodRowKind = "TEACHING" | "BREAK";

export interface PeriodRow {
  /** {@code null} for a period not yet persisted - mirrors backend ManagePeriodGridUseCase.PeriodCommand's id. */
  id: string | null;
  label: string;
  startTime: string;
  endTime: string;
  kind: PeriodRowKind;
  /** Whether any timetable entry (Phase 12C) references this period - a delete or TEACHING-to-BREAK flip is refused server-side while true. */
  inUse: boolean;
}

interface PeriodRowsProps {
  periods: PeriodRow[];
  onChange: (periods: PeriodRow[]) => void;
  /** BRANCH_ADMIN's read-only view of the grid - every control disabled, add/reorder/remove hidden entirely. */
  readOnly?: boolean;
}

const BLANK_PERIOD: PeriodRow = {
  id: null,
  label: "",
  startTime: "",
  endTime: "",
  kind: "TEACHING",
  inUse: false,
};

/**
 * The period-grid editor for one level - order carries meaning (it's the
 * day's reading order), so rows reorder via up/down arrows rather than free
 * drag, matching RatingScaleRows' pattern. The server always re-derives the
 * saved position by sorting on start time (PeriodGridPolicy.normalize), so
 * this reorder is a client-side convenience for editing, not the source of
 * truth for the saved order.
 *
 * A row still in use (referenced by a timetable entry, Phase 12C) shows a
 * disabled Delete with an explanatory tooltip rather than a silently
 * ignored click - the delete button is wrapped in its own `<span title>`
 * because `Button`'s `disabled:pointer-events-none` would otherwise
 * suppress the native tooltip on hover.
 */
export function PeriodRows({ periods, onChange, readOnly = false }: PeriodRowsProps) {
  function updateRow(index: number, patch: Partial<PeriodRow>) {
    onChange(periods.map((period, i) => (i === index ? { ...period, ...patch } : period)));
  }

  function addRow() {
    onChange([...periods, { ...BLANK_PERIOD }]);
  }

  function removeRow(index: number) {
    onChange(periods.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= periods.length) return;
    const reordered = [...periods];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Periods</h3>
        {!readOnly && (
          <button type="button" className="text-sm text-brand-500 hover:text-brand-600" onClick={addRow}>
            Add period
          </button>
        )}
      </div>

      {periods.length === 0 && <p className="text-sm text-slate-500">No periods yet - add at least one.</p>}

      <ol className="space-y-3">
        {periods.map((period, index) => (
          <li
            key={period.id ?? `new-${index}`}
            className="flex flex-col gap-3 rounded-control border border-slate-200 p-3 sm:flex-row sm:items-end"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
              {index + 1}
            </span>
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-4">
              <FormField label="Label" htmlFor={`period-${index}-label`}>
                <Input
                  id={`period-${index}-label`}
                  required
                  disabled={readOnly}
                  value={period.label}
                  onChange={(event) => updateRow(index, { label: event.target.value })}
                />
              </FormField>
              <FormField label="Start time" htmlFor={`period-${index}-start`}>
                <Input
                  id={`period-${index}-start`}
                  type="time"
                  required
                  disabled={readOnly}
                  value={period.startTime}
                  onChange={(event) => updateRow(index, { startTime: event.target.value })}
                />
              </FormField>
              <FormField label="End time" htmlFor={`period-${index}-end`}>
                <Input
                  id={`period-${index}-end`}
                  type="time"
                  required
                  disabled={readOnly}
                  value={period.endTime}
                  onChange={(event) => updateRow(index, { endTime: event.target.value })}
                />
              </FormField>
              <FormField label="Kind" htmlFor={`period-${index}-kind`}>
                <Select
                  id={`period-${index}-kind`}
                  value={period.kind}
                  disabled={readOnly}
                  onChange={(event) => updateRow(index, { kind: event.target.value as PeriodRowKind })}
                >
                  <option value="TEACHING">Teaching</option>
                  <option value="BREAK">Break</option>
                </Select>
              </FormField>
            </div>
            {!readOnly && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`Move ${period.label || "this period"} up`}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${period.label || "this period"} down`}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-30"
                  disabled={index === periods.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <span title={period.inUse ? "This period has scheduled entries - clear those cells before deleting it." : undefined}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    disabled={period.inUse}
                    onClick={() => removeRow(index)}
                  >
                    Remove
                  </Button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
