import { describe, expect, it } from "vitest";
import type { ScheduleSlot } from "@/api/virtualClasses";
import {
  addDays,
  dateInZone,
  mondayOf,
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
  it("reads an instant's local date and time in the creator's zone", () => {
    expect(dateInZone("2026-10-04T23:30:00Z", "Africa/Lagos")).toBe("2026-10-05");
    expect(timeInZone("2026-10-04T23:30:00Z", "Africa/Lagos")).toBe("00:30");
  });

  it("does calendar arithmetic across month ends and finds the week's Monday", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(mondayOf("2026-10-04")).toBe("2026-09-28");
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
  });
});
