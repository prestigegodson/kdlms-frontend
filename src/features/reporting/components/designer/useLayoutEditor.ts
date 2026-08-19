import { useCallback, useState } from "react";
import * as ops from "@/features/reporting/components/designer/layoutOps";
import type {
  LayoutElement,
  PageStyle,
  ReportLayout,
  RowStyle,
} from "@/features/reporting/components/designer/layout";

export type Selection = { type: "page" } | { type: "row"; rowId: string } | { type: "element"; elementId: string };

const HISTORY_LIMIT = 50;

/**
 * Reducer-shaped state for the layout designer canvas: the working
 * `ReportLayout`, the current selection (drives `InspectorPanel`), a dirty
 * flag (mirrors `TemplateDesignerPage`'s existing save/saved messaging), and
 * an undo/redo stack of prior snapshots. Every mutator delegates to the pure
 * functions in `layoutOps.ts` and pushes the pre-mutation layout onto the
 * undo stack - `layoutOps` itself has no notion of history.
 */
export function useLayoutEditor(initial: ReportLayout) {
  const [layout, setLayout] = useState<ReportLayout>(initial);
  const [past, setPast] = useState<ReportLayout[]>([]);
  const [future, setFuture] = useState<ReportLayout[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dirty, setDirty] = useState(false);

  const commit = useCallback(
    (next: ReportLayout) => {
      setPast((prev) => [...prev, layout].slice(-HISTORY_LIMIT));
      setFuture([]);
      setLayout(next);
      setDirty(true);
    },
    [layout],
  );

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const previous = prev[prev.length - 1];
      setFuture((f) => [layout, ...f].slice(0, HISTORY_LIMIT));
      setLayout(previous);
      setDirty(true);
      return prev.slice(0, -1);
    });
  }, [layout]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((p) => [...p, layout].slice(-HISTORY_LIMIT));
      setLayout(next);
      setDirty(true);
      return prev.slice(1);
    });
  }, [layout]);

  /** Replaces the working layout wholesale with no history - e.g. loading a template, or after a successful save's server round trip. */
  const reset = useCallback((next: ReportLayout, opts: { markDirty?: boolean } = {}) => {
    setLayout(next);
    setPast([]);
    setFuture([]);
    setSelection(null);
    setDirty(opts.markDirty ?? false);
  }, []);

  const clearSelection = useCallback(() => setSelection(null), []);

  const insertElement = useCallback(
    (containerId: string, index: number, element: LayoutElement, select = true) => {
      commit(ops.insertElement(layout, containerId, index, element));
      if (select) setSelection({ type: "element", elementId: element.id });
    },
    [layout, commit],
  );

  const removeElement = useCallback(
    (elementId: string) => {
      commit(ops.removeElement(layout, elementId));
      setSelection((sel) => (sel?.type === "element" && sel.elementId === elementId ? null : sel));
    },
    [layout, commit],
  );

  const moveElement = useCallback(
    (elementId: string, toContainerId: string, toIndex: number) => {
      commit(ops.moveElement(layout, elementId, toContainerId, toIndex));
    },
    [layout, commit],
  );

  const moveElementDirection = useCallback(
    (elementId: string, direction: "up" | "down") => {
      commit(ops.moveElementDirection(layout, elementId, direction));
    },
    [layout, commit],
  );

  const updateElement = useCallback(
    (elementId: string, patch: Partial<LayoutElement>) => {
      commit(ops.updateElement(layout, elementId, patch));
    },
    [layout, commit],
  );

  const appendElement = useCallback(
    (element: LayoutElement) => {
      commit(ops.appendToEnd(layout, element));
      setSelection({ type: "element", elementId: element.id });
    },
    [layout, commit],
  );

  /**
   * `BlockPalette`'s click-to-add path: lands `element` right where the
   * designer is currently working rather than always at the end of the
   * canvas (`appendElement`/`appendToEnd`) - directly after a selected
   * element (same container), at the end of a selected row's first column,
   * or falls back to `appendToEnd` when nothing - or the page - is selected.
   */
  const insertAtSelection = useCallback(
    (element: LayoutElement) => {
      if (selection?.type === "element") {
        const location = ops.findElementLocation(layout, selection.elementId);
        if (location) {
          commit(ops.insertElement(layout, location.containerId, location.index + 1, element));
          setSelection({ type: "element", elementId: element.id });
          return;
        }
      }
      if (selection?.type === "row") {
        commit(ops.appendToRow(layout, selection.rowId, element));
        setSelection({ type: "element", elementId: element.id });
        return;
      }
      commit(ops.appendToEnd(layout, element));
      setSelection({ type: "element", elementId: element.id });
    },
    [layout, commit, selection],
  );

  const addRow = useCallback(() => {
    const next = ops.addRow(layout);
    commit(next);
    const newRow = next.rows[next.rows.length - 1];
    setSelection({ type: "row", rowId: newRow.id });
  }, [layout, commit]);

  const removeRow = useCallback(
    (rowId: string) => {
      commit(ops.removeRow(layout, rowId));
      setSelection((sel) => (sel?.type === "row" && sel.rowId === rowId ? null : sel));
    },
    [layout, commit],
  );

  const moveRow = useCallback(
    (rowId: string, direction: "up" | "down") => {
      commit(ops.moveRow(layout, rowId, direction));
    },
    [layout, commit],
  );

  const updateRowStyle = useCallback(
    (rowId: string, style: RowStyle | undefined) => {
      commit(ops.updateRowStyle(layout, rowId, style));
    },
    [layout, commit],
  );

  const setColumnWidths = useCallback(
    (rowId: string, widths: number[]) => {
      commit(ops.setColumnWidths(layout, rowId, widths));
    },
    [layout, commit],
  );

  const updatePage = useCallback(
    (page: PageStyle) => {
      commit(ops.updatePage(layout, page));
    },
    [layout, commit],
  );

  return {
    layout,
    selection,
    setSelection,
    clearSelection,
    dirty,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undo,
    redo,
    reset,
    insertElement,
    appendElement,
    insertAtSelection,
    removeElement,
    moveElement,
    moveElementDirection,
    updateElement,
    addRow,
    removeRow,
    moveRow,
    updateRowStyle,
    setColumnWidths,
    updatePage,
  };
}

export type LayoutEditor = ReturnType<typeof useLayoutEditor>;
