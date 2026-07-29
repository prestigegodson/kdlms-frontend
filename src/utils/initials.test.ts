import { describe, expect, it } from "vitest";
import { initialsOf } from "@/utils/initials";

describe("initialsOf", () => {
  it("takes the first letter of each name, uppercased", () => {
    expect(initialsOf({ firstName: "Godson", lastName: "Ositadinma" })).toBe("GO");
  });

  it("lowercases input still comes out uppercase", () => {
    expect(initialsOf({ firstName: "ada", lastName: "obi" })).toBe("AO");
  });
});
