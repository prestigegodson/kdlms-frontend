import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatClockTime,
  formatDateRange,
  formatInstantDate,
  formatLongDate,
  formatMonthName,
  normalizeClockTime,
  parseClockMinutes,
} from "@/utils/date";

describe("formatLongDate", () => {
  it("formats an ISO date as 'D Month, YYYY'", () => {
    expect(formatLongDate("2026-06-29")).toBe("29 June, 2026");
  });

  it("does not shift the day regardless of the runner's timezone", () => {
    // new Date("2026-06-29") parses as UTC midnight and would render as
    // 28 June in negative-UTC-offset zones - guard against that regression.
    expect(formatLongDate("2027-07-29")).toBe("29 July, 2027");
  });

  it("returns an em dash for missing input", () => {
    expect(formatLongDate(undefined)).toBe("—");
    expect(formatLongDate(null)).toBe("—");
    expect(formatLongDate("")).toBe("—");
  });

  it("returns an em dash for unparseable input", () => {
    expect(formatLongDate("not-a-date")).toBe("—");
  });
});

describe("formatAge", () => {
  const today = new Date(2026, 8, 24); // 24 September 2026

  it("formats years and months", () => {
    expect(formatAge("2022-06-10", today)).toBe("4 yrs 3 months");
  });

  it("drops the month part on an exact birthday month", () => {
    expect(formatAge("2022-09-24", today)).toBe("4 yrs");
  });

  it("doesn't count a month until its day is reached", () => {
    expect(formatAge("2022-09-25", today)).toBe("3 yrs 11 months");
  });

  it("uses singulars", () => {
    expect(formatAge("2025-08-01", today)).toBe("1 yr 1 month");
  });

  it("shows months alone under a year", () => {
    expect(formatAge("2026-06-01", today)).toBe("3 months");
    expect(formatAge("2026-09-10", today)).toBe("0 months");
  });

  it("returns a dash for missing, unparseable, or future dates", () => {
    expect(formatAge(undefined, today)).toBe("—");
    expect(formatAge("not-a-date", today)).toBe("—");
    expect(formatAge("2026-10-01", today)).toBe("—");
  });
});

describe("formatMonthName", () => {
  it("formats an ISO date as the month name only", () => {
    expect(formatMonthName("2026-09-14")).toBe("September");
  });

  it("returns an em dash for missing/unparseable input", () => {
    expect(formatMonthName(undefined)).toBe("—");
    expect(formatMonthName(null)).toBe("—");
    expect(formatMonthName("")).toBe("—");
    expect(formatMonthName("not-a-date")).toBe("—");
  });
});

describe("formatDateRange", () => {
  it("formats a start/end pair", () => {
    expect(formatDateRange("2026-06-29", "2027-07-29")).toBe("29 June, 2026 - 29 July, 2027");
  });

  it("tolerates missing ends", () => {
    expect(formatDateRange(undefined, "2027-07-29")).toBe("— - 29 July, 2027");
    expect(formatDateRange("2026-06-29", undefined)).toBe("29 June, 2026 - —");
  });
});

describe("formatClockTime", () => {
  it("formats a morning time", () => {
    expect(formatClockTime("08:30")).toBe("08:30 AM");
  });

  it("formats an afternoon time", () => {
    expect(formatClockTime("14:10")).toBe("02:10 PM");
  });

  it("formats midnight as 12 AM", () => {
    expect(formatClockTime("00:15")).toBe("12:15 AM");
  });

  it("formats noon as 12 PM", () => {
    expect(formatClockTime("12:05")).toBe("12:05 PM");
  });

  it("tolerates a seconds-bearing value", () => {
    expect(formatClockTime("08:30:45")).toBe("08:30 AM");
  });

  it("returns an em dash for missing/unparseable input", () => {
    expect(formatClockTime(undefined)).toBe("—");
    expect(formatClockTime(null)).toBe("—");
    expect(formatClockTime("")).toBe("—");
    expect(formatClockTime("garbage")).toBe("—");
  });
});

describe("parseClockMinutes", () => {
  it("parses a 24-hour HH:mm value", () => {
    expect(parseClockMinutes("13:00")).toBe(13 * 60);
    expect(parseClockMinutes("00:00")).toBe(0);
    expect(parseClockMinutes("23:59")).toBe(23 * 60 + 59);
  });

  it("tolerates a seconds-bearing value", () => {
    expect(parseClockMinutes("12:30:45")).toBe(12 * 60 + 30);
  });

  it("parses a 12-hour display value, case-insensitively", () => {
    expect(parseClockMinutes("01:30 PM")).toBe(13 * 60 + 30);
    expect(parseClockMinutes("12:30 pm")).toBe(12 * 60 + 30);
    expect(parseClockMinutes("12:15 AM")).toBe(15);
  });

  it("agrees that a period ending at 1:00 PM and the next starting at 13:00 are the same instant", () => {
    // The reported bug: comparing "12:30 PM" (end) and "01:30 PM" (next start)
    // as raw strings is lexically true even though 12:30 PM < 1:30 PM.
    expect(parseClockMinutes("12:30 PM")).toBeLessThan(parseClockMinutes("01:30 PM")!);
    expect(parseClockMinutes("13:00")).toBe(parseClockMinutes("01:00 PM"));
  });

  it("returns null for missing/unparseable input", () => {
    expect(parseClockMinutes(undefined)).toBeNull();
    expect(parseClockMinutes(null)).toBeNull();
    expect(parseClockMinutes("")).toBeNull();
    expect(parseClockMinutes("garbage")).toBeNull();
    expect(parseClockMinutes("24:00")).toBeNull();
    expect(parseClockMinutes("13:00 PM")).toBeNull();
  });
});

describe("normalizeClockTime", () => {
  it("passes a 24-hour HH:mm value through unchanged", () => {
    expect(normalizeClockTime("13:00")).toBe("13:00");
  });

  it("strips a seconds component", () => {
    expect(normalizeClockTime("12:30:45")).toBe("12:30");
  });

  it("converts a 12-hour display value to 24-hour", () => {
    expect(normalizeClockTime("01:30 PM")).toBe("13:30");
    expect(normalizeClockTime("12:15 AM")).toBe("00:15");
  });

  it("returns null for missing/unparseable input", () => {
    expect(normalizeClockTime(undefined)).toBeNull();
    expect(normalizeClockTime("garbage")).toBeNull();
  });
});

describe("formatInstantDate", () => {
  it("formats an instant as 'D Mon YYYY' with no time component", () => {
    expect(formatInstantDate("2026-03-10T14:00:00Z")).toMatch(/^10 Mar 2026$/);
  });

  it("returns '—' for missing/unparseable input", () => {
    expect(formatInstantDate(undefined)).toBe("—");
    expect(formatInstantDate(null)).toBe("—");
    expect(formatInstantDate("")).toBe("—");
    expect(formatInstantDate("garbage")).toBe("—");
  });
});
