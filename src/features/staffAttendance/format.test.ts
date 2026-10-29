import { describe, expect, it } from "vitest";
import { formatLateMinutes } from "./format";

describe("formatLateMinutes", () => {
  it("keeps minutes under an hour", () => {
    expect(formatLateMinutes(15)).toBe("15m");
  });

  it("switches to hours and minutes from 60 up", () => {
    expect(formatLateMinutes(60)).toBe("1hr");
    expect(formatLateMinutes(99)).toBe("1hr 39m");
    expect(formatLateMinutes(125)).toBe("2hr 5m");
  });
});
