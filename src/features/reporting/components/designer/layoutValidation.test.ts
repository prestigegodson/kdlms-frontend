import { describe, expect, it } from "vitest";
import { isLayoutValid, validateLayout } from "@/features/reporting/components/designer/layoutValidation";
import type { LayoutElement, ReportBlockName, ReportLayout } from "@/features/reporting/components/designer/layout";

function layoutWith(rows: ReportLayout["rows"]): ReportLayout {
  return { version: 1, page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" }, rows };
}

function block(id: string, blockName: ReportBlockName): LayoutElement {
  return { id, type: "BLOCK", block: blockName };
}

describe("validateLayout", () => {
  it("accepts a well-formed layout", () => {
    const layout = layoutWith([
      { id: "row-1", columns: [{ id: "col-1", widthPercent: 60, elements: [block("el-1", "SCORE_TABLE")] }, { id: "col-2", widthPercent: 40, elements: [] }] },
    ]);

    expect(isLayoutValid(layout, "NUMERIC")).toBe(true);
  });

  it("rejects column widths that don't sum to 100", () => {
    const layout = layoutWith([
      { id: "row-1", columns: [{ id: "col-1", widthPercent: 60, elements: [] }, { id: "col-2", widthPercent: 30, elements: [] }] },
    ]);

    const errors = validateLayout(layout, "NUMERIC");
    expect(errors.some((e) => e.includes("sum to 100"))).toBe(true);
  });

  it("rejects a row with more than three columns", () => {
    const layout = layoutWith([
      {
        id: "row-1",
        columns: [
          { id: "c1", widthPercent: 25, elements: [] },
          { id: "c2", widthPercent: 25, elements: [] },
          { id: "c3", widthPercent: 25, elements: [] },
          { id: "c4", widthPercent: 25, elements: [] },
        ],
      },
    ]);

    expect(isLayoutValid(layout, "NUMERIC")).toBe(false);
  });

  it("rejects SCORE_TABLE on a QUALITATIVE template", () => {
    const layout = layoutWith([{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [block("el-1", "SCORE_TABLE")] }] }]);

    const errors = validateLayout(layout, "QUALITATIVE");
    expect(errors.some((e) => e.includes("SCORE_TABLE"))).toBe(true);
  });

  it("rejects RATING_TABLE on a NUMERIC template", () => {
    const layout = layoutWith([{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [block("el-1", "RATING_TABLE")] }] }]);

    expect(isLayoutValid(layout, "NUMERIC")).toBe(false);
  });

  it("rejects a BOX nested inside another BOX", () => {
    const innerBox: LayoutElement = { id: "box-2", type: "BOX", elements: [] };
    const outerBox: LayoutElement = { id: "box-1", type: "BOX", elements: [innerBox] };
    const layout = layoutWith([{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [outerBox] }] }]);

    const errors = validateLayout(layout, "NUMERIC");
    expect(errors.some((e) => e.includes("another BOX"))).toBe(true);
  });

  it("rejects a malformed color", () => {
    const layout: ReportLayout = {
      version: 1,
      page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "red" },
      rows: [{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [] }] }],
    };

    expect(isLayoutValid(layout, "NUMERIC")).toBe(false);
  });

  it("rejects a spacer height out of range", () => {
    const spacer: LayoutElement = { id: "sp-1", type: "SPACER", heightPx: 500 };
    const layout = layoutWith([{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [spacer] }] }]);

    expect(isLayoutValid(layout, "NUMERIC")).toBe(false);
  });

  it("rejects an unsupported layout version", () => {
    const layout = { ...layoutWith([{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [] }] }]), version: 99 };

    const errors = validateLayout(layout, "NUMERIC");
    expect(errors.some((e) => e.includes("version"))).toBe(true);
  });
});
