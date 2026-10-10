import { describe, expect, it } from "vitest";
import { groupSubjects } from "@/features/academics/subjectTarget";

const physics = { subjectId: "phy", subjectName: "Physics", subjectGroupId: "sci", subjectGroupName: "Sciences" };
const biology = { subjectId: "bio", subjectName: "Biology", subjectGroupId: "sci", subjectGroupName: "Sciences" };
const french = { subjectId: "fre", subjectName: "French", subjectGroupId: "lang", subjectGroupName: "Languages" };
const maths = { subjectId: "mth", subjectName: "Mathematics" };
const civic = { subjectId: "civ", subjectName: "Civic Education" };

describe("groupSubjects", () => {
  it("leaves an ungrouped list flat, in its incoming order", () => {
    expect(groupSubjects([maths, civic])).toEqual({ sections: [], ungrouped: [maths, civic] });
  });

  it("sections groups and their subjects alphabetically, ungrouped subjects trailing as given", () => {
    const { sections, ungrouped } = groupSubjects([maths, physics, french, civic, biology]);
    expect(sections.map((section) => [section.label, section.subjects.map((s) => s.subjectName)])).toEqual([
      ["Languages", ["French"]],
      ["Sciences", ["Biology", "Physics"]],
    ]);
    expect(sections.every((section) => !section.selectable)).toBe(true);
    expect(ungrouped).toEqual([maths, civic]);
  });

  it("marks selectable groups and lists one even with none of its subjects present", () => {
    const { sections } = groupSubjects([physics], [
      { subjectGroupId: "sci", subjectGroupName: "Sciences" },
      { subjectGroupId: "arts", subjectGroupName: "Arts" },
    ]);
    expect(sections.map((section) => [section.label, section.selectable, section.subjects.length])).toEqual([
      ["Arts", true, 0],
      ["Sciences", true, 1],
    ]);
  });

  it("keeps same-named groups on different levels apart, naming each level", () => {
    const { sections } = groupSubjects([
      { ...physics, levelName: "SSS" },
      { subjectId: "bsc", subjectName: "Basic Science", subjectGroupId: "sci-jss", subjectGroupName: "Sciences", levelName: "JSS" },
    ]);
    expect(sections.map((section) => section.label)).toEqual(["Sciences (JSS)", "Sciences (SSS)"]);
  });
});
