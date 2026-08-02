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
