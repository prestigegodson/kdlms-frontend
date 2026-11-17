import { describe, expect, it } from "vitest";
import type { ReportLayout } from "@/features/reporting/components/designer/layout";
import { validateLayout } from "@/features/reporting/components/designer/layoutValidation";
import { applyTheme, tint } from "@/features/reporting/components/designer/themePresets";

function layout(): ReportLayout {
  return {
    version: 1,
    page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a", tableStyle: { cellPadding: "ROOMY" } },
    rows: [
      {
        id: "row-1",
        columns: [
          {
            id: "col-1",
            widthPercent: 100,
            elements: [
              { id: "h-1", type: "BLOCK", block: "SCHOOL_HEADER", style: { heading: { uppercase: true } } },
              { id: "box-1", type: "BOX", elements: [{ id: "h-2", type: "BLOCK", block: "SCHOOL_HEADER" }] },
              { id: "s-1", type: "BLOCK", block: "SCORE_TABLE" },
            ],
          },
        ],
      },
    ],
  };
}

describe("tint", () => {
  it("leaves a colour unchanged at 0 and turns it white at 1", () => {
    expect(tint("#1f3a8a", 0)).toBe("#1f3a8a");
    expect(tint("#1f3a8a", 1)).toBe("#ffffff");
    expect(tint("#000000", 0.5)).toBe("#808080");
  });
});

describe("applyTheme", () => {
  it("derives header, band, table and school-name colours from one accent and keeps everything else", () => {
    const themed = applyTheme(layout(), "#1f3a8a");

    expect(themed.page.headerColors).toEqual({
      headerBackground: "#1f3a8a",
      headerText: "#ffffff",
      bandBackground: tint("#1f3a8a", 0.82),
      bandText: "#1f3a8a",
    });
    expect(themed.page.tableStyle).toEqual({ cellPadding: "ROOMY", borderColor: tint("#1f3a8a", 0.6), stripeColor: tint("#1f3a8a", 0.93) });
    const elements = themed.rows[0].columns[0].elements;
    expect(elements[0]).toMatchObject({ style: { heading: { uppercase: true, color: "#1f3a8a" } } });
    expect(elements[1].type === "BOX" && elements[1].elements[0]).toMatchObject({ style: { heading: { color: "#1f3a8a" } } });
    expect(elements[2].style).toBeUndefined();
  });

  it("recolours an existing page border but never adds one", () => {
    const framed = layout();
    framed.page.frame = { widthPx: 4, style: "double", color: "#000000", gapPx: 8 };

    expect(applyTheme(framed, "#7a1f2b").page.frame).toEqual({ widthPx: 4, style: "double", color: "#7a1f2b", gapPx: 8 });
    expect(applyTheme(layout(), "#7a1f2b").page.frame).toBeUndefined();
  });

  it("recolours a bordered box's border but leaves an unbordered box alone", () => {
    const boxed = layout();
    boxed.rows[0].columns[0].elements.push(
      { id: "box-2", type: "BOX", style: { border: true, borderWidthPx: 2 }, elements: [] },
      { id: "box-3", type: "BOX", elements: [] },
    );

    const elements = applyTheme(boxed, "#1f3a8a").rows[0].columns[0].elements;

    expect(elements[3].style).toEqual({ border: true, borderWidthPx: 2, borderColor: tint("#1f3a8a", 0.6) });
    expect(elements[4].style).toBeUndefined();
  });

  it("always produces a layout the validator accepts", () => {
    expect(validateLayout(applyTheme(layout(), "#5b2a86"), "NUMERIC")).toEqual([]);
  });
});
