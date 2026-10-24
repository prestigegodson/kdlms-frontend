import { describe, expect, it } from "vitest";
import type { InteractiveItem } from "@/api/learning";
import { checkBlanks, checkChoice, checkTrueFalse, parseBlanks } from "./check";
import {
  activeItems,
  clampSeek,
  crossedPauses,
  firstBlocking,
  formatTimecode,
  gateAt,
  isComplete,
  outOfRangeIds,
  parseTimecode,
  resumePoint,
} from "./engine";
import { newItem } from "./defaults";

function item(id: string, start: number, end: number, overrides: Partial<InteractiveItem> = {}): InteractiveItem {
  return { ...newItem("LABEL", start, 0.1, 0.1), id, start, end, ...overrides };
}

describe("engine", () => {
  const mandatoryQ = item("q", 10, 15, { type: "SINGLE_CHOICE", mandatory: "CORRECT", enableRetry: true });
  const answeredQ = item("free", 30, 35, { type: "FREE_TEXT", mandatory: "ANSWERED" });
  const label = item("label", 5, 40);
  const items = [label, mandatoryQ, answeredQ];

  it("shows items within their window, end exclusive", () => {
    expect(activeItems(items, 4).map((i) => i.id)).toEqual([]);
    expect(activeItems(items, 12).map((i) => i.id)).toEqual(["label", "q"]);
    expect(activeItems(items, 15).map((i) => i.id)).toEqual(["label"]);
  });

  it("blocks at the earliest unpassed mandatory item", () => {
    expect(firstBlocking(items, {}, 9)).toBeNull();
    expect(firstBlocking(items, {}, 100)?.id).toBe("q");
    expect(firstBlocking(items, { q: "wrong" }, 100)?.id).toBe("q");
    expect(firstBlocking(items, { q: "correct" }, 100)?.id).toBe("free");
    expect(firstBlocking(items, { q: "correct", free: "answered" }, 100)).toBeNull();
  });

  it("stops a forward seek at the first unpassed mandatory item, never a backward one", () => {
    expect(clampSeek(items, {}, 2, 50)).toBe(10);
    expect(clampSeek(items, { q: "correct" }, 12, 50)).toBe(30);
    expect(clampSeek(items, { q: "correct", free: "answered" }, 12, 50)).toBe(50);
    expect(clampSeek(items, {}, 50, 1)).toBe(1);
    // Already inside the blocking item's window: stay put rather than jump back to its start.
    expect(clampSeek(items, {}, 12, 50)).toBe(12);
    // A seek that stays before the blocker is free.
    expect(clampSeek(items, {}, 2, 8)).toBe(8);
  });

  it("gates at the end of an unpassed mandatory item's window", () => {
    expect(gateAt(items, {}, 12)).toBeNull();
    expect(gateAt(items, {}, 14.8)?.id).toBe("q");
    expect(gateAt(items, { q: "correct" }, 14.8)).toBeNull();
  });

  it("resumes at the earliest mandatory item before the saved position", () => {
    expect(resumePoint(items, null)).toBe(0);
    expect(resumePoint(items, 8)).toBe(8);
    expect(resumePoint(items, 33)).toBe(10);
    expect(resumePoint([label], 33)).toBe(33);
  });

  it("pauses once for each pausing item the playhead plays over, never on a backward jump", () => {
    const pausing = [item("p", 10, 12, { pause: true }), item("np", 10, 12)];
    expect(crossedPauses(pausing, 9.8, 10.1, new Set()).map((i) => i.id)).toEqual(["p"]);
    expect(crossedPauses(pausing, 9.8, 10.1, new Set(["p"]))).toEqual([]);
    expect(crossedPauses(pausing, 20, 10.1, new Set())).toEqual([]);
  });

  it("is complete once every mandatory item is passed", () => {
    expect(isComplete(items, {})).toBe(false);
    expect(isComplete(items, { q: "correct", free: "answered" })).toBe(true);
  });

  it("flags items and jump targets past a shorter video", () => {
    const jump = item("jump", 1, 3, { goTo: { kind: "TIME", seconds: 90, url: null } });
    expect([...outOfRangeIds([...items, jump], 32)]).toEqual(["label", "free", "jump"]);
    expect(outOfRangeIds(items, null).size).toBe(0);
  });

  it("formats and parses timecodes", () => {
    expect(formatTimecode(75)).toBe("1:15");
    expect(formatTimecode(3725)).toBe("1:02:05");
    expect(parseTimecode("1:15")).toBe(75);
    expect(parseTimecode("42")).toBe(42);
    expect(parseTimecode("1:02:05")).toBe(3725);
    expect(parseTimecode("abc")).toBeNull();
  });
});

describe("check", () => {
  const options = [
    { id: "a", text: "A", correct: true },
    { id: "b", text: "B", correct: false },
    { id: "c", text: "C", correct: true },
  ];
  const multi = item("m", 0, 1, { type: "MULTIPLE_CHOICE", content: { ...newItem("MULTIPLE_CHOICE", 0, 0, 0).content, options } });

  it("needs exactly the correct options", () => {
    expect(checkChoice(multi, ["a", "c"])).toBe(true);
    expect(checkChoice(multi, ["a"])).toBe(false);
    expect(checkChoice(multi, ["a", "b", "c"])).toBe(false);
  });

  it("checks a true/false statement", () => {
    const tf = item("tf", 0, 1, { type: "TRUE_FALSE", content: { ...multi.content, answer: false } });
    expect(checkTrueFalse(tf, false)).toBe(true);
    expect(checkTrueFalse(tf, true)).toBe(false);
  });

  it("parses blanks with alternatives and checks each one", () => {
    const text = "Water boils at *100/one hundred* degrees and freezes at *0*.";
    expect(parseBlanks(text)).toEqual([
      { kind: "text", value: "Water boils at " },
      { kind: "blank", answers: ["100", "one hundred"] },
      { kind: "text", value: " degrees and freezes at " },
      { kind: "blank", answers: ["0"] },
      { kind: "text", value: "." },
    ]);
    const blanks = item("b", 0, 1, { type: "FILL_BLANKS", content: { ...multi.content, text, caseSensitive: false } });
    expect(checkBlanks(blanks, ["One  Hundred", "0"])).toEqual([true, true]);
    expect(checkBlanks(blanks, ["99", ""])).toEqual([false, false]);
  });
});
