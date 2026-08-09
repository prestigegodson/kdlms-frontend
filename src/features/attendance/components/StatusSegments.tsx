import type { KeyboardEvent } from "react";
import type { AttendanceStatus } from "@/api/attendance";
import { ATTENDANCE_STATUSES } from "@/features/attendance/attendanceStatus";

const SELECTED_CLASSES: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600",
  ABSENT: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600",
  LATE: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600",
  EXCUSED: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600",
};

interface StatusSegmentsProps {
  id: string;
  value?: AttendanceStatus;
  studentName: string;
  onChange: (status: AttendanceStatus) => void;
  /** Called right after a selection - lets the grid move focus to the next student. */
  onAdvance?: () => void;
}

/**
 * The register's signature control: a four-way "Present/Absent/Late/Excused"
 * choice as one tap instead of a dropdown's two. Marked up as a `radiogroup`
 * for assistive tech; the letter keys P/A/L/E set a status and advance to
 * the next student in one motion - the fast path for calling a register
 * aloud. Selected segments fill with a semantic tint (never a solid fill -
 * see style_guide.md's amber-as-tint rule), and the same color marks the
 * row's left rail via `statusRailClass` (in `../attendanceStatus.ts`).
 */
export function StatusSegments({
  id,
  value,
  studentName,
  onChange,
  onAdvance,
}: StatusSegmentsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const match = ATTENDANCE_STATUSES.find((status) => status.glyph === event.key.toUpperCase());
    if (!match) return;
    event.preventDefault();
    onChange(match.value);
    onAdvance?.();
  }

  return (
    <div
      role="radiogroup"
      aria-label={`Attendance status for ${studentName}`}
      onKeyDown={handleKeyDown}
      className="inline-flex gap-1 mobile:grid mobile:min-w-0 mobile:flex-1 mobile:grid-cols-4 mobile:gap-1.5"
    >
      {ATTENDANCE_STATUSES.map((status) => {
        const selected = value === status.value;
        return (
          <button
            key={status.value}
            id={`${id}-${status.value}`}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${status.label} — ${studentName}`}
            title={status.label}
            onClick={() => {
              onChange(status.value);
              onAdvance?.();
            }}
            className={`rounded-control px-3 py-1.5 text-xs font-semibold transition-colors mobile:min-h-11 ${
              selected
                ? SELECTED_CLASSES[status.value]
                : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {status.glyph}
          </button>
        );
      })}
    </div>
  );
}
