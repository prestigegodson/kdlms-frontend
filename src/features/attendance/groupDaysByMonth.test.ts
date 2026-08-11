import { describe, expect, it } from "vitest";
import type { DayEntry } from "@/api/attendance";
import { groupDaysByMonth } from "@/features/attendance/groupDaysByMonth";

function day(date: string): DayEntry {
  return { date, status: "PRESENT" };
}

describe("groupDaysByMonth", () => {
  it("groups days into one entry per calendar month, in chronological order", () => {
    const days = [
      day("2026-01-05"),
      day("2026-01-06"),
      day("2026-02-02"),
      day("2026-03-10"),
      day("2026-04-01"),
      day("2026-04-02"),
    ];

    const groups = groupDaysByMonth(days);

    expect(groups.map(([monthKey]) => monthKey)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(groups[0][1]).toEqual([day("2026-01-05"), day("2026-01-06")]);
    expect(groups[3][1]).toEqual([day("2026-04-01"), day("2026-04-02")]);
  });

  it("omits a month with no recorded days entirely", () => {
    // January and April present, February/March skipped - no calendar padding.
    const days = [day("2026-01-15"), day("2026-04-20")];

    const groups = groupDaysByMonth(days);

    expect(groups.map(([monthKey]) => monthKey)).toEqual(["2026-01", "2026-04"]);
  });

  it("returns an empty array for no days", () => {
    expect(groupDaysByMonth([])).toEqual([]);
  });
});
