import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DAYS, MAX_DURATION, MIN_DURATION, type SlotDraft, toMinutes } from "../scheduleUtils";

interface ScheduleEditorProps {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
  disabled?: boolean;
}

let nextKey = 0;
function newKey(): string {
  nextKey += 1;
  return `new-${nextKey}`;
}

/**
 * A class's weekly schedule, one row per day - each day can hold any number of sessions, each
 * with its own start time and length, so times can differ by day (creators.md §7.1).
 */
export function ScheduleEditor({ slots, onChange, disabled = false }: ScheduleEditorProps) {
  function update(key: string, patch: Partial<SlotDraft>) {
    onChange(slots.map((slot) => (slot.key === key ? { ...slot, ...patch } : slot)));
  }

  function add(dayOfWeek: SlotDraft["dayOfWeek"]) {
    const sameDay = slots.filter((slot) => slot.dayOfWeek === dayOfWeek);
    const latestEnd = Math.max(
      0,
      ...sameDay.map((slot) => toMinutes(slot.startTime) + slot.durationMinutes),
    );
    const start = sameDay.length === 0 ? 9 * 60 : Math.min(latestEnd, 23 * 60);
    const startTime = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
    onChange([...slots, { key: newKey(), dayOfWeek, startTime, durationMinutes: 60 }]);
  }

  return (
    <div className="divide-y divide-slate-100">
      {DAYS.map((day) => {
        const daySlots = slots
          .filter((slot) => slot.dayOfWeek === day.value)
          .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
        return (
          <div key={day.value} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
            <div className="w-28 shrink-0 pt-2 text-sm font-medium text-slate-900">{day.label}</div>
            <div className="flex flex-1 flex-col gap-2">
              {daySlots.length === 0 && <p className="pt-2 text-sm text-slate-400">No sessions</p>}
              {daySlots.map((slot) => (
                <div key={slot.key} className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`slot-${slot.key}-start`}>
                    {day.label} start time
                  </label>
                  <Input
                    id={`slot-${slot.key}-start`}
                    type="time"
                    className="w-32"
                    value={slot.startTime}
                    disabled={disabled}
                    onChange={(event) => update(slot.key, { startTime: event.target.value })}
                  />
                  <label className="sr-only" htmlFor={`slot-${slot.key}-duration`}>
                    {day.label} duration in minutes
                  </label>
                  <Input
                    id={`slot-${slot.key}-duration`}
                    type="number"
                    className="w-24"
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    step={5}
                    value={Number.isNaN(slot.durationMinutes) ? "" : slot.durationMinutes}
                    disabled={disabled}
                    onChange={(event) =>
                      update(slot.key, { durationMinutes: event.target.valueAsNumber })
                    }
                  />
                  <span className="text-sm text-slate-500">min</span>
                  {!disabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${day.label} ${slot.startTime} session`}
                      onClick={() => onChange(slots.filter((other) => other.key !== slot.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {!disabled && (
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => add(day.value)}>
                    <Plus className="h-4 w-4" /> Add session
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
