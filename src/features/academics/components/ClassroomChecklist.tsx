import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/Checkbox";

/** One classroom row - `locked` shows it ticked (or, in single mode, unpicked) and unchangeable. */
export interface ClassroomChecklistItem {
  classId: string;
  className: string;
  locked?: boolean;
  /** A short trailing note, e.g. "Already shared" or "this classroom". */
  note?: string;
}

interface ClassroomChecklistProps {
  legend: ReactNode;
  items: ClassroomChecklistItem[];
  /** The unlocked classrooms currently picked. */
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Only one classroom may be picked (radio buttons). */
  single?: boolean;
  /** Prefixes each input's id, e.g. `quiz-class` gives `quiz-class-<classId>`. */
  idPrefix?: string;
  disabled?: boolean;
}

/**
 * A scrollable list of classrooms with a Select all / Clear all toggle - shared by the cross-class
 * share modal and the editors' own same-level classrooms field, so a level with many classrooms
 * stays a compact, bounded box instead of a wall of checkboxes.
 */
export function ClassroomChecklist({
  legend,
  items,
  selected,
  onChange,
  single = false,
  idPrefix = "classroom",
  disabled = false,
}: ClassroomChecklistProps) {
  const available = items.filter((item) => !item.locked);
  const allSelected = available.length > 0 && available.every((item) => selected.has(item.classId));

  function toggle(classId: string) {
    if (single) {
      onChange(new Set([classId]));
      return;
    }
    const next = new Set(selected);
    if (next.has(classId)) next.delete(classId);
    else next.add(classId);
    onChange(next);
  }

  /** Ticks or clears every unlocked classroom, keeping any locked one the caller had selected. */
  function toggleAll() {
    const availableIds = new Set(available.map((item) => item.classId));
    const kept = [...selected].filter((id) => !availableIds.has(id));
    onChange(new Set(allSelected ? kept : [...kept, ...availableIds]));
  }

  return (
    <fieldset className="space-y-1">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-medium text-slate-700">{legend}</legend>
        {!single && !disabled && available.length > 1 && (
          <button type="button" className="text-sm font-medium text-brand-600 hover:underline" onClick={toggleAll}>
            {allSelected ? "Clear all" : "Select all"}
          </button>
        )}
      </div>
      <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-control border border-slate-200 p-2">
        {items.map((item) => {
          const inactive = disabled || item.locked;
          return (
            <label
              key={item.classId}
              className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${
                item.locked ? "text-slate-400" : inactive ? "text-slate-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {single ? (
                <input
                  type="radio"
                  id={`${idPrefix}-${item.classId}`}
                  name={`${idPrefix}-radio`}
                  className="h-4 w-4 border-slate-300 text-brand-500"
                  checked={selected.has(item.classId)}
                  disabled={inactive}
                  onChange={() => toggle(item.classId)}
                />
              ) : (
                <Checkbox
                  id={`${idPrefix}-${item.classId}`}
                  checked={item.locked || selected.has(item.classId)}
                  disabled={inactive}
                  onChange={() => toggle(item.classId)}
                />
              )}
              {item.className}
              {item.note && <span className="text-xs"> · {item.note}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
