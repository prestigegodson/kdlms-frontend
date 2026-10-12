import { describe, expect, it } from "vitest";
import { award, scoreFromParts } from "./scoring";

const part = (partId: string, correct: boolean) => ({
  partId,
  correct,
  expectedRef: null,
  givenRef: null,
});

describe("award", () => {
  it("scales points by the share and rounds half-up to cents", () => {
    expect(award(2, "PARTIAL", 2, 3)).toBe(1.33);
    expect(award(1, "PARTIAL", 1, 200)).toBe(0.01);
    expect(award(1, "PARTIAL", 1, 201)).toBe(0);
    expect(award(5, "PARTIAL", 4, 4)).toBe(5);
  });

  it("rounds the exact ratio, not a rounded fraction", () => {
    expect(award(0.03, "PARTIAL", 5, 6)).toBe(0.03);
  });

  it("awards all-or-nothing only for a whole share", () => {
    expect(award(4, "ALL_OR_NOTHING", 3, 3)).toBe(4);
    expect(award(4, "ALL_OR_NOTHING", 2, 3)).toBe(0);
  });

  it("clamps the share", () => {
    expect(award(3, "PARTIAL", 5, 4)).toBe(3);
    expect(award(3, "PARTIAL", -1, 4)).toBe(0);
    expect(award(3, "PARTIAL", 1, 0)).toBe(0);
  });
});

describe("scoreFromParts", () => {
  it("flags partial credit", () => {
    const result = scoreFromParts(2, "PARTIAL", [
      part("a", true),
      part("b", true),
      part("c", false),
    ]);
    expect(result).toMatchObject({ awarded: 1.33, max: 2, partial: true });
  });

  it("scores nothing with no parts", () => {
    expect(scoreFromParts(1, "PARTIAL", [])).toMatchObject({ awarded: 0, partial: false });
  });
});
