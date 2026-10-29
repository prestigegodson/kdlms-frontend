import type { DayStatus, DayView, StaffRowView } from "@/api/staffAttendance";
import { STAFF_CATEGORY_LABELS } from "@/api/staffAttendance";

/** "07:42" for an instant, read in the branch's own timezone rather than the viewer's. */
export function formatClockTime(iso: string | null, timeZone: string): string {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
  } catch {
    return new Date(iso).toTimeString().slice(0, 5);
  }
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "—";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest.toString().padStart(2, "0")}m` : `${rest}m`;
}

/** "HH:mm" from the API's "HH:mm:ss" (or already "HH:mm"). */
export function shortTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export const ROLE_LABELS: Record<string, string> = {
  SCHOOL_ADMIN: "School admin",
  BRANCH_ADMIN: "Branch admin",
  TEACHER: "Teacher",
  INVENTORY_MANAGER: "Inventory manager",
};

/** What a person does - their login role for academic staff, their category (or job title) otherwise. */
export function staffRoleLabel(row: Pick<StaffRowView, "role" | "category" | "jobTitle">): string {
  if (row.role) {
    return ROLE_LABELS[row.role] ?? row.role;
  }
  if (row.category === "OTHER" && row.jobTitle) {
    return row.jobTitle;
  }
  return row.category ? STAFF_CATEGORY_LABELS[row.category] : "—";
}

export type BadgeVariant = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

export const DAY_STATUS_LABEL: Record<DayStatus, string> = {
  PRESENT: "Present",
  CLOCKED_IN: "On site",
  NOT_CLOCKED_IN: "Not in yet",
  ABSENT: "Absent",
  OFF_DAY: "Off day",
};

export const DAY_STATUS_VARIANT: Record<DayStatus, BadgeVariant> = {
  PRESENT: "success",
  CLOCKED_IN: "info",
  NOT_CLOCKED_IN: "neutral",
  ABSENT: "danger",
  OFF_DAY: "neutral",
};

/** The flags worth calling out on a day, in reading order. */
export function dayFlags(day: DayView): Array<{ label: string; variant: BadgeVariant }> {
  const flags: Array<{ label: string; variant: BadgeVariant }> = [];
  if (day.late) {
    flags.push({ label: `Late ${day.lateMinutes}m`, variant: "warning" });
  }
  if (day.earlyLeave) {
    flags.push({ label: "Left early", variant: "warning" });
  }
  if (day.missingClockOut) {
    flags.push({ label: "No clock-out", variant: "neutral" });
  }
  return flags;
}

/** Today in the given zone, as "YYYY-MM-DD". */
export function todayIn(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(new Date());
    return parts.slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export const DEFAULT_TIMEZONE = "Africa/Lagos";
