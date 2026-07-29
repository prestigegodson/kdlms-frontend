const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "long" });

/**
 * Parses a "YYYY-MM-DD" (LocalDate JSON) string into a local Date at
 * midnight. Deliberately avoids `new Date(iso)`, which parses as UTC
 * midnight and renders as the previous day in negative-UTC-offset zones.
 */
function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
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
export function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  return `${formatLongDate(start)} - ${formatLongDate(end)}`;
}
