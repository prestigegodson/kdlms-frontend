import type { AttendanceStatus } from "@/api/attendance";

/** Separate from `components/StatusSegments.tsx` so fast refresh doesn't warn about a file mixing a component with plain helpers - mirrors `assessments/finalScore.ts`. */
export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string; glyph: string }[] = [
  { value: "PRESENT", label: "Present", glyph: "P" },
  { value: "ABSENT", label: "Absent", glyph: "A" },
  { value: "LATE", label: "Late", glyph: "L" },
  { value: "EXCUSED", label: "Excused", glyph: "E" },
];

const BADGE_VARIANTS: Record<AttendanceStatus, "success" | "danger" | "warning" | "info"> = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  EXCUSED: "info",
};

/** The `Badge` variant for a status in every read-only rendering (grids, day lists). */
export function statusBadgeVariant(
  status: AttendanceStatus,
): "success" | "danger" | "warning" | "info" {
  return BADGE_VARIANTS[status];
}

/** The row-rail tint a selected status lends its `TableRow` - see AttendanceRegisterGrid. */
export function statusRailClass(status: AttendanceStatus | undefined): string {
  switch (status) {
    case "PRESENT":
      return "border-l-green-500";
    case "ABSENT":
      return "border-l-red-500";
    case "LATE":
      return "border-l-amber-500";
    case "EXCUSED":
      return "border-l-blue-500";
    default:
      return "border-l-slate-200";
  }
}
