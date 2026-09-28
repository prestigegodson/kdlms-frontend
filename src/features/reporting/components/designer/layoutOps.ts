import {
  CELL_FORBIDDEN_TYPES,
  type LayoutColumn,
  type LayoutElement,
  type LayoutRow,
  type PageStyle,
  type ReportLayout,
  type RowCondition,
  type RowStyle,
  type TableSpec,
  newElementId,
} from "@/features/reporting/components/designer/layout";

/**
 * Pure, immutable operations over a `ReportLayout` - every function returns
 * a new layout rather than mutating its argument, so `useLayoutEditor`'s
 * undo/redo stack can simply keep prior snapshots around. Kept dependency-free
 * and framework-free on purpose so it's unit-testable with no React involved.
 */

/** Which kind of container an element sits directly inside - drives `canPlace`'s nesting rules. */
export type ContainerKind = "column" | "box" | "cell";

interface ElementLocation {
  containerId: string;
  containerKind: ContainerKind;
  index: number;
  element: LayoutElement;
}

/**
 * A table cell has no `id` of its own - its container id is derived from its
 * row's id (already unique, see `newElementId("trow")`) and its index within
 * the row, and only ever compared for equality, never parsed. A cell's
 * `elements` move with it automatically on a merge/split since they live on
 * the cell itself (see `tableOps.ts`).
 */
export function cellContainerId(rowId: string, cellIndex: number): string {
  return `tcell|${rowId}|${cellIndex}`;
}

/**
 * Whether `elementType` may be placed directly inside a container of
 * `containerKind` - the one place both nesting rules live: a `BOX` may not
 * contain another `BOX`, and a table cell may not contain a `BOX` or another
 * `TABLE` (so nesting from a cell can never go more than one level deep
 * either). Mirrors backend `ReportLayoutValidator`'s `validateBox`/
 * `validateTableCellElements`.
 */
export function canPlace(elementType: LayoutElement["type"], containerKind: ContainerKind): boolean {
  if (containerKind === "box" && elementType === "BOX") return false;
  if (containerKind === "cell" && CELL_FORBIDDEN_TYPES.has(elementType)) return false;
  return true;
}

/** Rewrites the single container (a column, a BOX element's own children, or a TABLE cell's own elements) identified by `containerId`, leaving everything else structurally unchanged. */
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
    if (element.type === "BOX") {
      if (element.id === containerId) {
        return { ...element, elements: fn(element.elements) };
      }
      return { ...element, elements: transformElements(element.elements, containerId, fn) };
    }
    if (element.type === "TABLE") {
      const table = transformTable(element.table, containerId, fn);
      return table === element.table ? element : { ...element, table };
    }
    return element;
  });
}

/** Mirrors `transformElements`, one level down into every cell of a TABLE's rows - a cell with no elements yet is left untouched unless it's the target container itself. */
function transformTable(
  table: TableSpec,
  containerId: string,
  fn: (elements: LayoutElement[]) => LayoutElement[],
): TableSpec {
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell, index) => {
        if (cellContainerId(row.id, index) === containerId) {
          return { ...cell, elements: fn(cell.elements ?? []) };
        }
        if (!cell.elements || cell.elements.length === 0) return cell;
        return { ...cell, elements: transformElements(cell.elements, containerId, fn) };
      }),
    })),
  };
}

function findInElements(
  elements: LayoutElement[],
  containerId: string,
  containerKind: ContainerKind,
  elementId: string,
): ElementLocation | undefined {
  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];
    if (element.id === elementId) {
      return { containerId, containerKind, index, element };
    }
    if (element.type === "BOX") {
      const found = findInElements(element.elements, element.id, "box", elementId);
      if (found) return found;
    }
    if (element.type === "TABLE") {
      const found = findInTable(element.table, elementId);
      if (found) return found;
    }
  }
  return undefined;
}

function findInTable(table: TableSpec, elementId: string): ElementLocation | undefined {
  for (const row of table.rows) {
    for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex += 1) {
      const cell = row.cells[cellIndex];
      if (!cell.elements || cell.elements.length === 0) continue;
      const found = findInElements(cell.elements, cellContainerId(row.id, cellIndex), "cell", elementId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findElementLocation(layout: ReportLayout, elementId: string): ElementLocation | undefined {
  for (const row of layout.rows) {
    for (const column of row.columns) {
      const found = findInElements(column.elements, column.id, "column", elementId);
      if (found) return found;
    }
  }
  return undefined;
}

function findTableElementIdOwningRow(elements: LayoutElement[], rowId: string): string | undefined {
  for (const element of elements) {
    if (element.type === "TABLE" && element.table.rows.some((row) => row.id === rowId)) {
      return element.id;
    }
    if (element.type === "BOX") {
      const found = findTableElementIdOwningRow(element.elements, rowId);
      if (found) return found;
    }
    // A TABLE cell may never contain another TABLE (see `canPlace`), so there's no need to recurse into cells here.
  }
  return undefined;
}

/**
 * The location of the element that *owns* a given container - the BOX
 * itself when `containerKind` is `"box"` (a BOX's own id doubles as its
 * children's container id, so this is just `findElementLocation` on it), or
 * the TABLE that has a row with `containerId`'s embedded row id when
 * `containerKind` is `"cell"`. `useLayoutEditor.insertAtSelection` uses this
 * to "bubble up" an insert the selected element's own container can't accept
 * (e.g. adding a BOX while a cell's own child is selected) so it lands right
 * after the owning TABLE/BOX instead of being silently dropped.
 */
export function findContainerOwnerLocation(
  layout: ReportLayout,
  containerId: string,
  containerKind: ContainerKind,
): ElementLocation | undefined {
  if (containerKind === "box") {
    return findElementLocation(layout, containerId);
  }
  if (containerKind === "cell") {
    const rowId = containerId.split("|")[1];
    for (const row of layout.rows) {
      for (const column of row.columns) {
        const tableId = findTableElementIdOwningRow(column.elements, rowId);
        if (tableId) return findElementLocation(layout, tableId);
      }
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

/** Appends `element` to the end of a specific row's first column - `useLayoutEditor.insertAtSelection`'s row-selected case, so a click-to-add lands where the designer is working rather than always at the very end of the canvas. */
export function appendToRow(layout: ReportLayout, rowId: string, element: LayoutElement): ReportLayout {
  const row = layout.rows.find((r) => r.id === rowId);
  if (!row || row.columns.length === 0) return layout;
  const firstColumn = row.columns[0];
  return insertElement(layout, firstColumn.id, firstColumn.elements.length, element);
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

export function updateRowCondition(layout: ReportLayout, rowId: string, condition: RowCondition | undefined): ReportLayout {
  return { ...layout, rows: layout.rows.map((row) => (row.id === rowId ? { ...row, condition } : row)) };
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
