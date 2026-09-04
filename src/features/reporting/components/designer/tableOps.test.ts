import { describe, expect, it } from "vitest";
import * as tableOps from "@/features/reporting/components/designer/tableOps";
import type { TableSpec } from "@/features/reporting/components/designer/layout";

describe("tableOps", () => {
  it("newTableSpec seeds the requested rows and columns with empty cells", () => {
    const spec = tableOps.newTableSpec(2, 3);

    expect(spec.rows).toHaveLength(2);
    expect(spec.rows[0].cells).toHaveLength(3);
    expect(spec.rows[0].cells.every((cell) => cell.text === "")).toBe(true);
  });

  it("evenColumnWidths always sums to exactly 100", () => {
    expect(tableOps.evenColumnWidths(3).reduce((a, b) => a + b, 0)).toBe(100);
    expect(tableOps.evenColumnWidths(7).reduce((a, b) => a + b, 0)).toBe(100);
    expect(tableOps.evenColumnWidths(1)).toEqual([100]);
  });

  it("setRowCount growing preserves existing rows and appends blank ones", () => {
    let spec = tableOps.newTableSpec(1, 2);
    spec = tableOps.setCell(spec, 0, 0, { text: "kept" });

    const grown = tableOps.setRowCount(spec, 3);

    expect(grown.rows).toHaveLength(3);
    expect(grown.rows[0].cells[0].text).toBe("kept");
    expect(grown.rows[2].cells).toHaveLength(2);
  });

  it("setRowCount shrinking drops trailing rows without touching survivors", () => {
    let spec = tableOps.newTableSpec(3, 2);
    spec = tableOps.setCell(spec, 0, 0, { text: "kept" });

    const shrunk = tableOps.setRowCount(spec, 1);

    expect(shrunk.rows).toHaveLength(1);
    expect(shrunk.rows[0].cells[0].text).toBe("kept");
  });

  it("setColumnCount growing pads every row with empty cells", () => {
    let spec = tableOps.newTableSpec(2, 1);
    spec = tableOps.setCell(spec, 0, 0, { text: "kept" });

    const grown = tableOps.setColumnCount(spec, 3);

    expect(grown.columnCount).toBe(3);
    expect(grown.rows[0].cells).toHaveLength(3);
    expect(grown.rows[0].cells[0].text).toBe("kept");
    expect(grown.rows[1].cells).toHaveLength(3);
  });

  it("setColumnCount shrinking clamps a colspan that would overrun the new column count", () => {
    let spec = tableOps.newTableSpec(1, 4);
    spec = tableOps.setCell(spec, 0, 0, { text: "wide", colSpan: 4 });

    const shrunk = tableOps.setColumnCount(spec, 2);

    expect(shrunk.rows[0].cells).toHaveLength(1);
    expect(shrunk.rows[0].cells[0].text).toBe("wide");
    expect(shrunk.rows[0].cells[0].colSpan).toBe(2);
  });

  it("setColumnCount shrinking drops cells that no longer fit and pads a short row", () => {
    let spec = tableOps.newTableSpec(1, 3);
    spec = tableOps.setCell(spec, 0, 0, { text: "a" });
    spec = tableOps.setCell(spec, 0, 1, { text: "b" });
    spec = tableOps.setCell(spec, 0, 2, { text: "c" });

    const shrunk = tableOps.setColumnCount(spec, 2);

    expect(shrunk.rows[0].cells).toHaveLength(2);
    expect(shrunk.rows[0].cells.map((c) => c.text)).toEqual(["a", "b"]);
  });

  it("setColumnCount recomputes column widths evenly when widths were set", () => {
    const spec = tableOps.distributeWidthsEvenly(tableOps.newTableSpec(1, 2));

    const grown = tableOps.setColumnCount(spec, 4);

    expect(grown.columnWidthsPercent).toEqual(tableOps.evenColumnWidths(4));
  });

  it("setColumnCount leaves widths unset when they were never set", () => {
    const spec = tableOps.newTableSpec(1, 2);

    const grown = tableOps.setColumnCount(spec, 3);

    expect(grown.columnWidthsPercent).toBeUndefined();
  });

  it("setColumnCount clamps to the 1..MAX_TABLE_COLUMNS range", () => {
    const spec = tableOps.newTableSpec(1, 2);

    expect(tableOps.setColumnCount(spec, 0).columnCount).toBe(1);
    expect(tableOps.setColumnCount(spec, 99).columnCount).toBeLessThanOrEqual(8);
  });

  it("setCell patches only the targeted cell", () => {
    const spec = tableOps.newTableSpec(2, 2);

    const next = tableOps.setCell(spec, 1, 0, { text: "hi", bold: true });

    expect(next.rows[1].cells[0]).toMatchObject({ text: "hi", bold: true });
    expect(next.rows[0].cells[0].text).toBe("");
    expect(next.rows[1].cells[1].text).toBe("");
  });

  it("distributeWidthsEvenly sets a width array summing to 100", () => {
    const spec = tableOps.newTableSpec(1, 3);

    const next = tableOps.distributeWidthsEvenly(spec);

    expect(next.columnWidthsPercent).toHaveLength(3);
    expect(next.columnWidthsPercent!.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("setColumnWidth initializes widths evenly before overriding the target index", () => {
    const spec: TableSpec = tableOps.newTableSpec(1, 3);

    const next = tableOps.setColumnWidth(spec, 1, 50);

    expect(next.columnWidthsPercent![1]).toBe(50);
  });

  it("clearColumnWidths removes the width array", () => {
    const spec = tableOps.distributeWidthsEvenly(tableOps.newTableSpec(1, 2));

    expect(tableOps.clearColumnWidths(spec).columnWidthsPercent).toBeUndefined();
  });
});
