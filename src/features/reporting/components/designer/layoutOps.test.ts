import { describe, expect, it } from "vitest";
import * as ops from "@/features/reporting/components/designer/layoutOps";
import { buildStandardResultSheetLayout } from "@/features/reporting/components/designer/starterLayouts";
import type { LayoutElement, ReportLayout } from "@/features/reporting/components/designer/layout";

function blankLayout(): ReportLayout {
  return {
    version: 1,
    page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
    rows: [{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [] }] }],
  };
}

function textElement(id: string): LayoutElement {
  return { id, type: "TEXT", text: "hello" };
}

describe("layoutOps", () => {
  it("insertElement adds an element into the target column at the given index", () => {
    const layout = ops.insertElement(blankLayout(), "col-1", 0, textElement("el-1"));

    expect(layout.rows[0].columns[0].elements).toHaveLength(1);
    expect(layout.rows[0].columns[0].elements[0].id).toBe("el-1");
  });

  it("removeElement drops an element wherever it lives, including inside a BOX", () => {
    let layout = ops.insertElement(blankLayout(), "col-1", 0, {
      id: "box-1",
      type: "BOX",
      elements: [textElement("el-1")],
    });
    layout = ops.removeElement(layout, "el-1");

    const box = layout.rows[0].columns[0].elements[0];
    expect(box.type).toBe("BOX");
    expect((box as { elements: LayoutElement[] }).elements).toHaveLength(0);
  });

  it("findElementLocation locates an element nested inside a BOX", () => {
    const layout = ops.insertElement(blankLayout(), "col-1", 0, {
      id: "box-1",
      type: "BOX",
      elements: [textElement("el-1")],
    });

    const location = ops.findElementLocation(layout, "el-1");

    expect(location?.containerId).toBe("box-1");
    expect(location?.index).toBe(0);
  });

  it("moveElementDirection swaps an element with its neighbour", () => {
    let layout = ops.insertElement(blankLayout(), "col-1", 0, textElement("el-1"));
    layout = ops.insertElement(layout, "col-1", 1, textElement("el-2"));

    layout = ops.moveElementDirection(layout, "el-2", "up");

    expect(layout.rows[0].columns[0].elements.map((e) => e.id)).toEqual(["el-2", "el-1"]);
  });

  it("moveElementDirection is a no-op past the start or end of a container", () => {
    const layout = ops.insertElement(blankLayout(), "col-1", 0, textElement("el-1"));

    const unchanged = ops.moveElementDirection(layout, "el-1", "up");

    expect(unchanged).toEqual(layout);
  });

  it("updateElement patches only the targeted element", () => {
    let layout = ops.insertElement(blankLayout(), "col-1", 0, textElement("el-1"));
    layout = ops.updateElement(layout, "el-1", { text: "updated" } as Partial<LayoutElement>);

    expect((layout.rows[0].columns[0].elements[0] as { text: string }).text).toBe("updated");
  });

  it("addRow appends a full-width row; moveRow reorders rows", () => {
    let layout = ops.addRow(blankLayout());
    expect(layout.rows).toHaveLength(2);
    const secondRowId = layout.rows[1].id;

    layout = ops.moveRow(layout, secondRowId, "up");

    expect(layout.rows[0].id).toBe(secondRowId);
  });

  it("removeRow drops the row entirely", () => {
    const layout = blankLayout();
    const next = ops.removeRow(layout, layout.rows[0].id);

    expect(next.rows).toHaveLength(0);
  });

  it("setColumnWidths reducing column count appends the removed columns' elements onto the last survivor rather than discarding them", () => {
    let layout: ReportLayout = {
      ...blankLayout(),
      rows: [
        {
          id: "row-1",
          columns: [
            { id: "col-1", widthPercent: 50, elements: [textElement("el-1")] },
            { id: "col-2", widthPercent: 50, elements: [textElement("el-2")] },
          ],
        },
      ],
    };

    layout = ops.setColumnWidths(layout, "row-1", [100]);

    expect(layout.rows[0].columns).toHaveLength(1);
    expect(layout.rows[0].columns[0].elements.map((e) => e.id)).toEqual(["el-1", "el-2"]);
  });

  it("setColumnWidths increasing column count appends empty columns", () => {
    const layout = ops.setColumnWidths(blankLayout(), "row-1", [50, 50]);

    expect(layout.rows[0].columns).toHaveLength(2);
    expect(layout.rows[0].columns[1].elements).toEqual([]);
  });

  it("appendToRow adds an element to the end of the row's first column", () => {
    let layout: ReportLayout = {
      ...blankLayout(),
      rows: [
        {
          id: "row-1",
          columns: [
            { id: "col-1", widthPercent: 50, elements: [textElement("el-1")] },
            { id: "col-2", widthPercent: 50, elements: [] },
          ],
        },
      ],
    };

    layout = ops.appendToRow(layout, "row-1", textElement("el-2"));

    expect(layout.rows[0].columns[0].elements.map((e) => e.id)).toEqual(["el-1", "el-2"]);
    expect(layout.rows[0].columns[1].elements).toEqual([]);
  });

  it("appendToRow is a no-op for an unknown row id", () => {
    const layout = blankLayout();

    const unchanged = ops.appendToRow(layout, "no-such-row", textElement("el-1"));

    expect(unchanged).toEqual(layout);
  });

  it("updateRowCondition sets a row's condition", () => {
    const condition = { match: "ALL" as const, rules: [{ flag: "HAS_CLASS_TEACHER_REMARK" as const, expected: true }] };

    const layout = ops.updateRowCondition(blankLayout(), "row-1", condition);

    expect(layout.rows[0].condition).toEqual(condition);
  });

  it("updateRowCondition clears a row's condition back to undefined", () => {
    const condition = { match: "ALL" as const, rules: [{ flag: "HAS_CLASS_TEACHER_REMARK" as const }] };
    const withCondition = ops.updateRowCondition(blankLayout(), "row-1", condition);

    const cleared = ops.updateRowCondition(withCondition, "row-1", undefined);

    expect(cleared.rows[0].condition).toBeUndefined();
  });

  it("updateRowCondition leaves other rows' conditions untouched", () => {
    let layout: ReportLayout = {
      ...blankLayout(),
      rows: [
        { id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [] }] },
        { id: "row-2", columns: [{ id: "col-2", widthPercent: 100, elements: [] }] },
      ],
    };
    const condition = { match: "ALL" as const, rules: [{ flag: "IS_MIDTERM" as const }] };
    layout = ops.updateRowCondition(layout, "row-2", condition);

    const updated = ops.updateRowCondition(layout, "row-1", { match: "ANY" as const, rules: [{ flag: "HAS_STUDENT_PHOTO" as const }] });

    expect(updated.rows[1].condition).toEqual(condition);
  });

  it("addRow's new row starts with no condition", () => {
    const layout = ops.addRow(blankLayout());

    expect(layout.rows[layout.rows.length - 1].condition).toBeUndefined();
  });

  it("moveRow preserves an existing row's condition", () => {
    const condition = { match: "ALL" as const, rules: [{ flag: "HAS_PRINCIPAL_REMARK" as const }] };
    let layout: ReportLayout = {
      ...blankLayout(),
      rows: [
        { id: "row-1", condition, columns: [{ id: "col-1", widthPercent: 100, elements: [] }] },
        { id: "row-2", columns: [{ id: "col-2", widthPercent: 100, elements: [] }] },
      ],
    };

    layout = ops.moveRow(layout, "row-1", "down");

    expect(layout.rows.find((r) => r.id === "row-1")?.condition).toEqual(condition);
  });

  it("setColumnWidths preserves a row's own condition", () => {
    const condition = { match: "ALL" as const, rules: [{ flag: "HAS_SCHOOL_LOGO" as const }] };
    const withCondition = ops.updateRowCondition(blankLayout(), "row-1", condition);

    const layout = ops.setColumnWidths(withCondition, "row-1", [50, 50]);

    expect(layout.rows[0].condition).toEqual(condition);
  });

  it("the standard result sheet starter is a structurally sound layout tree", () => {
    const layout = buildStandardResultSheetLayout();

    expect(layout.rows.length).toBeGreaterThan(0);
    const scoreTableLocation = ops.findElementLocation(
      layout,
      layout.rows.flatMap((r) => r.columns).flatMap((c) => c.elements).find((e) => e.type === "BLOCK" && e.block === "SCORE_TABLE")!.id,
    );
    expect(scoreTableLocation).toBeDefined();
  });
});
