import { describe, expect, it } from "vitest";
import type { MessageView } from "@/api/communication";
import { continuesRun, dayLabel, groupByDay, listTime } from "@/features/classMessages/components/chatTimeline";

function message(id: string, createdAt: Date, overrides: Partial<MessageView> = {}): MessageView {
  return {
    messageId: id,
    threadId: "t1",
    authorId: "u1",
    authorRole: "CREATOR",
    body: id,
    createdAt: createdAt.toISOString(),
    canEdit: false,
    editableUntil: createdAt.toISOString(),
    ...overrides,
  };
}

const NOW = new Date(2026, 9, 12, 15, 0);

describe("dayLabel", () => {
  it("names today and yesterday, else the weekday and date", () => {
    expect(dayLabel(new Date(2026, 9, 12, 8, 0), NOW)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 11, 23, 59), NOW)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 5, 9, 0), NOW)).toBe("Mon 5 Oct");
    expect(dayLabel(new Date(2025, 11, 31, 9, 0), NOW)).toBe("31 Dec 2025");
  });
});

describe("listTime", () => {
  it("shows the clock today and the date before yesterday", () => {
    expect(listTime(new Date(2026, 9, 12, 9, 5).toISOString(), NOW)).toBe("9:05");
    expect(listTime(new Date(2026, 9, 11, 9, 5).toISOString(), NOW)).toBe("Yesterday");
    expect(listTime(new Date(2026, 9, 1, 9, 5).toISOString(), NOW)).toBe("1 Oct");
  });
});

describe("groupByDay", () => {
  it("splits messages into one run per calendar day, in order", () => {
    const groups = groupByDay([
      message("a", new Date(2026, 9, 11, 22, 0)),
      message("b", new Date(2026, 9, 12, 8, 0)),
      message("c", new Date(2026, 9, 12, 9, 0)),
    ]);
    expect(groups.map((group) => group.messages.map((m) => m.messageId))).toEqual([["a"], ["b", "c"]]);
  });
});

describe("continuesRun", () => {
  const first = message("a", new Date(2026, 9, 12, 9, 0));

  it("joins the same author within five minutes", () => {
    expect(continuesRun(first, message("b", new Date(2026, 9, 12, 9, 4)))).toBe(true);
  });

  it("breaks on another author, a long gap, or an announcement", () => {
    expect(continuesRun(first, message("b", new Date(2026, 9, 12, 9, 1), { authorId: "u2" }))).toBe(false);
    expect(continuesRun(first, message("b", new Date(2026, 9, 12, 9, 6)))).toBe(false);
    expect(continuesRun(first, message("b", new Date(2026, 9, 12, 9, 1), { announcement: true }))).toBe(false);
    expect(continuesRun(first, undefined)).toBe(false);
  });
});
