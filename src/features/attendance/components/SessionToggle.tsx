import type { AttendanceSession } from "@/api/attendance";
import { useFilterChip } from "@/components/ui/StickySubHeader";
import { sessionLabel } from "@/features/attendance/attendanceStatus";

/** `null` means "every session" - only offered where totals are summed (the term summary). */
export type SessionFilter = AttendanceSession | null;

interface SessionToggleProps {
  session: SessionFilter;
  onChange: (session: SessionFilter) => void;
  /** Adds an "All day" option ahead of Morning/Afternoon, for views that can sum both registers. */
  includeAll?: boolean;
}

/**
 * A Morning / Afternoon segmented control for a school that takes two
 * registers a day - the attendance counterpart to assessments'
 * `ScopeToggle` (same radiogroup markup and always-set filter chip). Callers
 * only render it when School Settings' `twoSessionAttendance` is on, so a
 * once-a-day school never sees it.
 */
export function SessionToggle({ session, onChange, includeAll = false }: SessionToggleProps) {
  useFilterChip("session", session ? sessionLabel(session) : "All day");

  const options: Array<{ value: SessionFilter; label: string }> = [
    ...(includeAll ? [{ value: null, label: "All day" }] : []),
    { value: "MORNING", label: sessionLabel("MORNING") },
    { value: "AFTERNOON", label: sessionLabel("AFTERNOON") },
  ];

  return (
    <div role="radiogroup" aria-label="Register session" className="inline-flex rounded-control border border-slate-200 bg-white p-1">
      {options.map((option) => {
        const selected = session === option.value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-control px-3 py-1.5 text-sm font-medium mobile:min-h-11 ${
              selected ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
