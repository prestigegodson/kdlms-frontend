import type { DayEntry } from "@/api/attendance";

/**
 * Groups a term's day entries by calendar month, keyed on the "YYYY-MM"
 * prefix of `date`. The backend returns `days` sorted ascending by date
 * (`StudentAttendanceAssembler`), so insertion order into the `Map` is
 * already chronological - mirrors `guardian/groupWardsBySchool.ts`'s shape.
 * A month with no marked day simply never appears; there is no calendar
 * padding to skip.
 */
export function groupDaysByMonth(days: DayEntry[]): [string, DayEntry[]][] {
  const groups = new Map<string, DayEntry[]>();
  for (const day of days) {
    const monthKey = day.date.slice(0, 7);
    const group = groups.get(monthKey);
    if (group) {
      group.push(day);
    } else {
      groups.set(monthKey, [day]);
    }
  }
  return [...groups.entries()];
}
