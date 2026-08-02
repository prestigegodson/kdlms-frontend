import {
  type LayoutColumn,
  type LayoutElement,
  type LayoutRow,
  type PageStyle,
  type ReportLayout,
  type RowStyle,
  newElementId,
} from "@/features/reporting/components/designer/layout";

/**
 * Pure, immutable operations over a `ReportLayout` - every function returns
 * a new layout rather than mutating its argument, so `useLayoutEditor`'s
 * undo/redo stack can simply keep prior snapshots around. Kept dependency-free
 * and framework-free on purpose so it's unit-testable with no React involved.
 */

interface ElementLocation {
  containerId: string;
  index: number;
  element: LayoutElement;
}

/** Rewrites the single container (a column, or a BOX element's own children) identified by `containerId`, leaving everything else structurally unchanged. */
function transformContainer(
  layout: ReportLayout,
  containerId: string,
  fn: (elements: LayoutElement[]) => LayoutElement[],
): ReportLayout {
  return {
    ...layout,
    rows: layout.rows.map((row) => ({
      ...row,
      columns: row.columns.map((column) =>
        column.id === containerId
          ? { ...column, elements: fn(column.elements) }
          : { ...column, elements: transformElements(column.elements, containerId, fn) },
      ),
    })),
  };
}

function transformElements(
  elements: LayoutElement[],
  containerId: string,
  fn: (elements: LayoutElement[]) => LayoutElement[],
): LayoutElement[] {
  return elements.map((element) => {
    if (element.type !== "BOX") return element;
    if (element.id === containerId) {
      return { ...element, elements: fn(element.elements) };
    }
    return { ...element, elements: transformElements(element.elements, containerId, fn) };
  });
}

function findInElements(elements: LayoutElement[], containerId: string, elementId: string): ElementLocation | undefined {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element.id === elementId) {
      return { containerId, index, element };
    }
    if (element.type === "BOX") {
      const found = findInElements(element.elements, element.id, elementId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findElementLocation(layout: ReportLayout, elementId: string): ElementLocation | undefined {
  for (const row of layout.rows) {
    for (const column of row.columns) {
      const found = findInElements(column.elements, column.id, elementId);
      if (found) return found;
    }
  }
  return undefined;
}

export function insertElement(
  layout: ReportLayout,
  containerId: string,
  index: number,
  element: LayoutElement,
): ReportLayout {
  return transformContainer(layout, containerId, (elements) => {
    const next = elements.slice();
    next.splice(Math.max(0, Math.min(index, next.length)), 0, element);
    return next;
  });
}

export function removeElement(layout: ReportLayout, elementId: string): ReportLayout {
  const location = findElementLocation(layout, elementId);
  if (!location) return layout;
  return transformContainer(layout, location.containerId, (elements) => elements.filter((el) => el.id !== elementId));
}

export function moveElement(layout: ReportLayout, elementId: string, toContainerId: string, toIndex: number): ReportLayout {
  const location = findElementLocation(layout, elementId);
  if (!location) return layout;
  const without = removeElement(layout, elementId);
  let adjustedIndex = toIndex;
  if (location.containerId === toContainerId && location.index < toIndex) {
    adjustedIndex -= 1;
  }
  return insertElement(without, toContainerId, adjustedIndex, location.element);
}

export function moveElementDirection(layout: ReportLayout, elementId: string, direction: "up" | "down"): ReportLayout {
  const location = findElementLocation(layout, elementId);
  if (!location) return layout;
  const targetIndex = direction === "up" ? location.index - 1 : location.index + 1;
  if (targetIndex < 0) return layout;
  return transformContainer(layout, location.containerId, (elements) => {
    if (targetIndex >= elements.length) return elements;
    const next = elements.slice();
    const [item] = next.splice(location.index, 1);
    next.splice(targetIndex, 0, item);
    return next;
  });
}

export function updateElement(layout: ReportLayout, elementId: string, patch: Partial<LayoutElement>): ReportLayout {
  const location = findElementLocation(layout, elementId);
  if (!location) return layout;
  return transformContainer(layout, location.containerId, (elements) =>
    elements.map((element) => (element.id === elementId ? ({ ...element, ...patch } as LayoutElement) : element)),
  );
}

/** Appends `element` to the end of the last column of the last row, creating a first row/column if the layout is currently empty - the target `BlockPalette`'s click-to-append (as opposed to drag-and-drop) uses. */
export function appendToEnd(layout: ReportLayout, element: LayoutElement): ReportLayout {
  if (layout.rows.length === 0) {
    const column: LayoutColumn = { id: newElementId("col"), widthPercent: 100, elements: [element] };
    const row: LayoutRow = { id: newElementId("row"), columns: [column] };
    return { ...layout, rows: [row] };
  }
  const lastRow = layout.rows[layout.rows.length - 1];
  const lastColumn = lastRow.columns[lastRow.columns.length - 1];
  return insertElement(layout, lastColumn.id, lastColumn.elements.length, element);
}

export function addRow(layout: ReportLayout): ReportLayout {
  const row: LayoutRow = {
    id: newElementId("row"),
    columns: [{ id: newElementId("col"), widthPercent: 100, elements: [] }],
  };
  return { ...layout, rows: [...layout.rows, row] };
}

export function removeRow(layout: ReportLayout, rowId: string): ReportLayout {
  return { ...layout, rows: layout.rows.filter((row) => row.id !== rowId) };
}

export function moveRow(layout: ReportLayout, rowId: string, direction: "up" | "down"): ReportLayout {
  const index = layout.rows.findIndex((row) => row.id === rowId);
  if (index < 0) return layout;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= layout.rows.length) return layout;
  const rows = layout.rows.slice();
  const [item] = rows.splice(index, 1);
  rows.splice(targetIndex, 0, item);
  return { ...layout, rows };
}

export function updateRowStyle(layout: ReportLayout, rowId: string, style: RowStyle | undefined): ReportLayout {
  return { ...layout, rows: layout.rows.map((row) => (row.id === rowId ? { ...row, style } : row)) };
}

/**
 * Redistributes a row to exactly `widths.length` columns at those widths.
 * Reducing the column count never discards an element - the removed
 * columns' elements are appended onto the last surviving column, since
 * silent data loss in a designer is unacceptable. Increasing appends empty
 * columns.
 */
export function setColumnWidths(layout: ReportLayout, rowId: string, widths: number[]): ReportLayout {
  return {
    ...layout,
    rows: layout.rows.map((row) => {
      if (row.id !== rowId) return row;
      const existing = row.columns;
      const next: LayoutColumn[] = widths.map((widthPercent, index) => {
        const current = existing[index];
        return current ? { ...current, widthPercent } : { id: newElementId("col"), widthPercent, elements: [] };
      });
      if (existing.length > widths.length) {
        const overflow = existing.slice(widths.length).flatMap((column) => column.elements);
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, elements: [...last.elements, ...overflow] };
      }
      return { ...row, columns: next };
    }),
  };
}

export function updatePage(layout: ReportLayout, page: PageStyle): ReportLayout {
  return { ...layout, page };
}
