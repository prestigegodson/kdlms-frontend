import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLayoutEditor } from "@/features/reporting/components/designer/useLayoutEditor";
import type { LayoutElement, ReportLayout } from "@/features/reporting/components/designer/layout";

function blankLayout(): ReportLayout {
  return {
    version: 1,
    page: { paddingPx: 24, fontFamily: "Helvetica, Arial, sans-serif", fontSizePx: 12, color: "#1a1a1a" },
    rows: [{ id: "row-1", columns: [{ id: "col-1", widthPercent: 100, elements: [] }] }],
  };
}

const TEXT_ELEMENT: LayoutElement = { id: "el-1", type: "TEXT", text: "hello" };

describe("useLayoutEditor", () => {
  it("starts clean (not dirty, no history) and becomes dirty on the first mutation", () => {
    const { result } = renderHook(() => useLayoutEditor(blankLayout()));

    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);

    act(() => result.current.insertElement("col-1", 0, TEXT_ELEMENT));

    expect(result.current.dirty).toBe(true);
    expect(result.current.layout.rows[0].columns[0].elements).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);
  });

  it("inserting an element selects it", () => {
    const { result } = renderHook(() => useLayoutEditor(blankLayout()));

    act(() => result.current.insertElement("col-1", 0, TEXT_ELEMENT));

    expect(result.current.selection).toEqual({ type: "element", elementId: "el-1" });
  });

  it("removing the selected element clears the selection", () => {
    const { result } = renderHook(() => useLayoutEditor(blankLayout()));
    act(() => result.current.insertElement("col-1", 0, TEXT_ELEMENT));

    act(() => result.current.removeElement("el-1"));

    expect(result.current.selection).toBeNull();
    expect(result.current.layout.rows[0].columns[0].elements).toHaveLength(0);
  });

  it("undo restores the prior layout and redo replays the change", () => {
    const { result } = renderHook(() => useLayoutEditor(blankLayout()));
    act(() => result.current.insertElement("col-1", 0, TEXT_ELEMENT));
    expect(result.current.layout.rows[0].columns[0].elements).toHaveLength(1);

    act(() => result.current.undo());
    expect(result.current.layout.rows[0].columns[0].elements).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.layout.rows[0].columns[0].elements).toHaveLength(1);
  });

  it("reset clears history and the dirty flag", () => {
    const { result } = renderHook(() => useLayoutEditor(blankLayout()));
    act(() => result.current.insertElement("col-1", 0, TEXT_ELEMENT));

    act(() => result.current.reset(blankLayout()));

    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.selection).toBeNull();
  });

  it("addRow appends a row and selects it", () => {
    const { result } = renderHook(() => useLayoutEditor(blankLayout()));

    act(() => result.current.addRow());

    expect(result.current.layout.rows).toHaveLength(2);
    expect(result.current.selection?.type).toBe("row");
  });
});
