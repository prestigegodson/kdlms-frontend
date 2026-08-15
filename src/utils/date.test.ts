import { describe, expect, it } from "vitest";
import { formatClockTime, formatDateRange, formatLongDate, formatMonthName } from "@/utils/date";

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
