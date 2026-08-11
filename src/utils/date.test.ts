import { describe, expect, it } from "vitest";
import { formatDateRange, formatLongDate, formatMonthName } from "@/utils/date";

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
