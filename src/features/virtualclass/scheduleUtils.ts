import type { DayOfWeek, ScheduleSlot } from "@/api/virtualClasses";

export const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 7, label: "Sunday", short: "Sun" },
];

export const MIN_DURATION = 5;
export const MAX_DURATION = 480;

/** A slot being edited - `key` is stable across renders, `id` is set for a slot already saved. */
export interface SlotDraft {
  key: string;
  id?: string;
  dayOfWeek: DayOfWeek;
  /** "HH:mm". */
  startTime: string;
  durationMinutes: number;
}

/** "09:00:00" or "09:00" -> "09:00". */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

export function toMinutes(time: string): number {
  const [hours, minutes] = hhmm(time).split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinutes(total: number): string {
  if (total >= 24 * 60) return "24:00";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function dayShort(day: DayOfWeek): string {
  return DAYS[day - 1].short;
}

export function slotRange(slot: { startTime: string; durationMinutes: number }): string {
  const start = toMinutes(slot.startTime);
  return `${formatMinutes(start)}–${formatMinutes(start + slot.durationMinutes)}`;
}

/** "Mon 09:00–10:00 · Wed 14:00–14:45", ordered by day then time. */
export function scheduleSummary(slots: ScheduleSlot[]): string {
  return [...slots]
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime))
    .map((slot) => `${dayShort(slot.dayOfWeek)} ${slotRange(slot)}`)
    .join(" · ");
}

/**
 * The client-side mirror of the backend's slot rules (virtualclass.domain.ScheduleSlot and
 * ScheduleClashPolicy#requireNoOverlap): one message per problem, so the editor can explain
 * them before the save round-trip. The server stays the authority.
 */
export function scheduleProblems(slots: SlotDraft[]): string[] {
  const problems: string[] = [];
  for (const slot of slots) {
    if (!/^\d{2}:\d{2}$/.test(hhmm(slot.startTime))) {
      problems.push(`${DAYS[slot.dayOfWeek - 1].label}: enter a start time.`);
      continue;
    }
    if (
      !Number.isInteger(slot.durationMinutes) ||
      slot.durationMinutes < MIN_DURATION ||
      slot.durationMinutes > MAX_DURATION
    ) {
      problems.push(
        `${DAYS[slot.dayOfWeek - 1].label} ${hhmm(slot.startTime)}: a session lasts ${MIN_DURATION}–${MAX_DURATION} minutes.`,
      );
    } else if (toMinutes(slot.startTime) + slot.durationMinutes > 24 * 60) {
      problems.push(
        `${DAYS[slot.dayOfWeek - 1].label} ${hhmm(slot.startTime)}: a session must end by midnight.`,
      );
    }
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      const aStart = toMinutes(a.startTime);
      const bStart = toMinutes(b.startTime);
      if (aStart < bStart + b.durationMinutes && bStart < aStart + a.durationMinutes) {
        problems.push(
          `${DAYS[a.dayOfWeek - 1].label}: ${slotRange(a)} and ${slotRange(b)} overlap.`,
        );
      }
    }
  }
  return problems;
}

/** "YYYY-MM-DD" of an instant as seen in `timeZone`. */
export function dateInZone(instant: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}

/** "HH:mm" of an instant as seen in `timeZone`. */
export function timeInZone(instant: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}

/** Whole minutes between two instants. */
export function minutesBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

/** Calendar arithmetic on "YYYY-MM-DD" strings, timezone-free. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** The Monday on or before `date`. */
export function mondayOf(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

/** "Monday 5 October" for a "YYYY-MM-DD". */
export function longDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** "5 Oct 2026" for a "YYYY-MM-DD". */
export function shortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
