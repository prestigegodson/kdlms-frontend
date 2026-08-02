const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "long" });

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
