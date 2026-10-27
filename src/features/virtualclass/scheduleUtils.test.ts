import { describe, expect, it } from "vitest";
import type { ScheduleSlot } from "@/api/virtualClasses";
import {
  addDays,
  addMonths,
  dateInZone,
  mondayOf,
  monthGrid,
  monthLabel,
  monthOf,
  scheduleProblems,
  scheduleSummary,
  type SlotDraft,
  timeInZone,
} from "./scheduleUtils";

function draft(
  dayOfWeek: SlotDraft["dayOfWeek"],
  startTime: string,
  durationMinutes: number,
): SlotDraft {
  return { key: `${dayOfWeek}-${startTime}`, dayOfWeek, startTime, durationMinutes };
}

describe("scheduleProblems", () => {
  it("accepts back-to-back sessions and the same time on different days", () => {
    expect(
      scheduleProblems([draft(1, "09:00", 60), draft(1, "10:00", 60), draft(2, "09:00", 60)]),
    ).toEqual([]);
  });

  it("reports overlapping sessions on the same day", () => {
    expect(scheduleProblems([draft(3, "14:00", 60), draft(3, "14:30", 30)])).toEqual([
      "Wednesday: 14:00–15:00 and 14:30–15:00 overlap.",
    ]);
  });

  it("reports a session that crosses midnight or has an out-of-range length", () => {
    expect(scheduleProblems([draft(5, "23:30", 60), draft(6, "09:00", 2)])).toEqual([
      "Friday 23:30: a session must end by midnight.",
      "Saturday 09:00: a session lasts 5–480 minutes.",
    ]);
  });
});

describe("scheduleSummary", () => {
  it("orders slots by day then time", () => {
    const slots: ScheduleSlot[] = [
      { id: "b", dayOfWeek: 3, startTime: "14:00:00", durationMinutes: 45 },
      { id: "a", dayOfWeek: 1, startTime: "17:00", durationMinutes: 60 },
      { id: "c", dayOfWeek: 1, startTime: "09:00", durationMinutes: 60 },
    ];
    expect(scheduleSummary(slots)).toBe("Mon 09:00–10:00 · Mon 17:00–18:00 · Wed 14:00–14:45");
  });
});

describe("date helpers", () => {
  it("reads an instant's local date and time in the tutor's zone", () => {
    expect(dateInZone("2026-10-04T23:30:00Z", "Africa/Lagos")).toBe("2026-10-05");
    expect(timeInZone("2026-10-04T23:30:00Z", "Africa/Lagos")).toBe("00:30");
  });

  it("does calendar arithmetic across month ends and finds the week's Monday", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
  });
});

describe("month helpers", () => {
  it("steps across year boundaries and labels a month", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthOf("2026-10-21")).toBe("2026-10");
    expect(monthLabel("2026-10")).toBe("October 2026");
  });

  it("builds whole Sunday-first weeks around the month", () => {
    const october = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday, 31 Oct a Saturday
    expect(october[0]).toBe("2026-09-27");
    expect(october.at(-1)).toBe("2026-10-31");
    expect(october).toHaveLength(35);
  });

  it("needs six weeks when the month starts late in the week", () => {
    const august = monthGrid("2026-08"); // 1 Aug 2026 is a Saturday
    expect(august[0]).toBe("2026-07-26");
    expect(august.at(-1)).toBe("2026-09-05");
    expect(august).toHaveLength(42);
  });

  it("fits a February starting on Sunday in four weeks", () => {
    const february = monthGrid("2026-02"); // 1 Feb 2026 is a Sunday
    expect(february[0]).toBe("2026-02-01");
    expect(february.at(-1)).toBe("2026-02-28");
    expect(february).toHaveLength(28);
  });
});
