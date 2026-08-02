import { describe, expect, it } from "vitest";
import { isLayoutValid } from "@/features/reporting/components/designer/layoutValidation";
import {
  buildBlankLayout,
  buildEarlyYearsProgressReportLayout,
  buildStandardResultSheetLayout,
  starterLayoutsForMode,
  STARTER_LAYOUTS,
} from "@/features/reporting/components/designer/starterLayouts";
import type { LayoutElement } from "@/features/reporting/components/designer/layout";

function allBlockNames(layout: ReturnType<typeof buildStandardResultSheetLayout>): string[] {
  const names: string[] = [];
  function walk(elements: LayoutElement[]) {
    for (const element of elements) {
      if (element.type === "BLOCK") names.push(element.block);
      if (element.type === "BOX") walk(element.elements);
    }
  }
  for (const row of layout.rows) {
    for (const column of row.columns) walk(column.elements);
  }
  return names;
}

describe("starterLayouts", () => {
  it("the blank starter passes validation under either mode", () => {
    expect(isLayoutValid(buildBlankLayout(), "NUMERIC")).toBe(true);
    expect(isLayoutValid(buildBlankLayout(), "QUALITATIVE")).toBe(true);
  });

  it("the standard result sheet is valid under NUMERIC and uses only NUMERIC-fitting blocks", () => {
    const layout = buildStandardResultSheetLayout();

    expect(isLayoutValid(layout, "NUMERIC")).toBe(true);
    expect(allBlockNames(layout)).toEqual(
      expect.arrayContaining(["SCHOOL_HEADER", "STUDENT_BIO", "SCORE_TABLE", "ATTENDANCE_SUMMARY", "GRADE_KEY"]),
    );
    expect(allBlockNames(layout)).not.toContain("RATING_TABLE");
    expect(allBlockNames(layout)).not.toContain("RATING_LEGEND");
  });

  it("the standard result sheet is rejected under QUALITATIVE", () => {
    expect(isLayoutValid(buildStandardResultSheetLayout(), "QUALITATIVE")).toBe(false);
  });

  it("the early years progress report is valid under QUALITATIVE and uses only QUALITATIVE-fitting blocks", () => {
    const layout = buildEarlyYearsProgressReportLayout();

    expect(isLayoutValid(layout, "QUALITATIVE")).toBe(true);
    expect(allBlockNames(layout)).toEqual(
      expect.arrayContaining(["SCHOOL_HEADER", "STUDENT_BIO", "RATING_TABLE", "ATTENDANCE_SUMMARY", "RATING_LEGEND"]),
    );
    expect(allBlockNames(layout)).not.toContain("SCORE_TABLE");
    expect(allBlockNames(layout)).not.toContain("GRADE_KEY");
  });

  it("the early years progress report is rejected under NUMERIC", () => {
    expect(isLayoutValid(buildEarlyYearsProgressReportLayout(), "NUMERIC")).toBe(false);
  });

  it("starterLayoutsForMode never offers a mode-mismatched starter", () => {
    for (const option of starterLayoutsForMode("NUMERIC")) {
      expect(isLayoutValid(option.build(), "NUMERIC")).toBe(true);
    }
    for (const option of starterLayoutsForMode("QUALITATIVE")) {
      expect(isLayoutValid(option.build(), "QUALITATIVE")).toBe(true);
    }
  });

  it("every registered starter has a unique id", () => {
    const ids = STARTER_LAYOUTS.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
