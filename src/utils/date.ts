const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "long" });
const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "short" });

/**
 * Parses a "YYYY-MM-DD" (LocalDate JSON) string into a local Date at
 * midnight. Deliberately avoids `new Date(iso)`, which parses as UTC
 * midnight and renders as the previous day in negative-UTC-offset zones.
 * Exported for `components/ui/DateInput`, which needs the same parsing to
 * drive its calendar grid - keep this the one place that logic lives.
 */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Formats a local `Date` back to "YYYY-MM-DD" - the inverse of `parseIsoDate`. */
export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "2026-06-29" -> "29 June, 2026". Returns "—" for missing/unparseable input. */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseIsoDate(iso);
  if (!date) {
    return "—";
  }
  return `${date.getDate()} ${MONTH_FORMATTER.format(date)}, ${date.getFullYear()}`;
}

/** "2026-06-29" -> "June". Returns "—" for missing/unparseable input. */
export function formatMonthName(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseIsoDate(iso);
  if (!date) {
    return "—";
  }
  return MONTH_FORMATTER.format(date);
}

/** "2026-06-29", "2027-07-29" -> "29 June, 2026 - 29 July, 2027". */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  return `${formatLongDate(start)} - ${formatLongDate(end)}`;
}

/**
 * Today's date in the local timezone as "YYYY-MM-DD" - the LocalDate wire
 * format the backend expects for `<input type="date">` values and query
 * params. Deliberately not `new Date().toISOString()`, which reports UTC
 * and can land on the wrong calendar day in positive-UTC-offset zones after
 * local midnight.
 */
export function todayIso(): string {
  return toIso(new Date());
}

/** True for Saturday/Sunday - see `ClassDatePicker`'s weekday-only default (CLAUDE.md's attendance rules). */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * "1990-08-14" -> "14 Aug" - a birth date shown year-less, since only the
 * day/month matter for an upcoming-birthdays list (`UpcomingBirthdaysCard`).
 * Returns "—" for missing/unparseable input.
 */
export function formatDayAndMonth(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseIsoDate(iso);
  if (!date) {
    return "—";
  }
  return `${date.getDate()} ${SHORT_MONTH_FORMATTER.format(date)}`;
}

/** "0 -> Today", "1 -> Tomorrow", "n -> in n days" - `BirthdayView.daysUntil`'s display form. */
export function formatDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) {
    return "Today";
  }
  if (daysUntil === 1) {
    return "Tomorrow";
  }
  return `in ${daysUntil} days`;
}

/**
 * "08:30" -> "08:30 AM", "14:10" -> "02:10 PM". Tolerates the "HH:mm:ss"
 * form Jackson emits when a LocalTime carries non-zero seconds; the seconds
 * are dropped, since a bell time is only ever minute-precise. Returns "—"
 * for missing/unparseable input.
 *
 * Deliberately hand-rolled rather than Intl.DateTimeFormat with hour12:
 * modern ICU separates the AM/PM marker with U+202F (narrow no-break space)
 * rather than a plain space, which is invisible in review but breaks any
 * assertion on the literal "08:30 AM". Display-only - never feed the result
 * back to an `<input type="time">` or to PeriodGridPage's string
 * comparisons, both of which require the raw 24-hour value.
 */
export function formatClockTime(time: string | null | undefined): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time ?? "");
  if (!match) {
    return "—";
  }
  const hour = Number(match[1]);
  const minute = match[2];
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = String(hour % 12 || 12).padStart(2, "0");
  return `${twelveHour}:${minute} ${period}`;
}

/**
 * Today if it's a weekday, otherwise the most recent Friday - the default
 * date `TeacherRegisterPanel` seeds when the school hasn't opted in to
 * weekend attendance, so opening the page on a Saturday/Sunday doesn't land
 * on a date the picker immediately greys out.
 */
export function mostRecentWeekdayIso(): string {
  const date = new Date();
  const day = date.getDay();
  if (day === 0) {
    date.setDate(date.getDate() - 2);
  } else if (day === 6) {
    date.setDate(date.getDate() - 1);
  }
  return toIso(date);
}
