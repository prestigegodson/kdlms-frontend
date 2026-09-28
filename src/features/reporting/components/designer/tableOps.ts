import {
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  type LayoutElement,
  type TableCell,
  type TableRow,
  type TableSpec,
} from "@/features/reporting/components/designer/layout";
import { newElementId } from "@/features/reporting/components/designer/layout";

/**
 * Pure, immutable operations over a `TableSpec` - the same discipline
 * `layoutOps.ts` follows for the rest of the layout, and for the same
 * reason: `useLayoutEditor.updateElement` does a shallow spread, so a nested
 * `TableSpec` must always be rebuilt whole rather than patched in place.
 */

function emptyCell(): TableCell {
  return { text: "" };
}

function newTableRow(columnCount: number): TableRow {
  return { id: newElementId("trow"), cells: Array.from({ length: columnCount }, emptyCell) };
}

/** Distributes 100 evenly across `count` columns, the last absorbing the rounding remainder so the sum is always exactly 100 - the same trick the backend's `ReportLayoutPruner.redistributeWidths` uses. */
export function evenColumnWidths(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(100 / count);
  const widths = Array.from({ length: count }, () => base);
  widths[widths.length - 1] = 100 - base * (count - 1);
  return widths;
}

export function newTableSpec(rowCount = 2, columnCount = 2): TableSpec {
  return {
    columnCount,
    headerRow: false,
    borderWidthPx: 1,
    borderStyle: "solid",
    cellPaddingPx: 4,
    rows: Array.from({ length: rowCount }, () => newTableRow(columnCount)),
  };
}

/**
 * Re-fits a row's cells to `columnCount`, never discarding a cell's text or
 * elements silently: a cell whose colspan would overrun the new column count
 * is clamped down to fit, a cell that no longer has room at all is dropped
 * but its own `elements` are carried onto the last surviving cell (the same
 * "append the overflow, never lose it" rule `layoutOps.setColumnWidths` uses
 * for a reduced row's columns), and a row left short is padded with empty
 * cells - so the row's cells always sum to exactly `columnCount`, the same
 * invariant `ReportLayoutValidator` enforces server-side. A dropped cell's
 * plain `text` has no such rescue - it was already the pre-existing
 * behaviour before cells could carry elements, and there's no single
 * "surviving" text field to append it to.
 */
function normalizeRow(cells: TableCell[], columnCount: number): TableCell[] {
  const result: TableCell[] = [];
  let spanned = 0;
  let overflowElements: LayoutElement[] = [];
  for (const cell of cells) {
    if (spanned >= columnCount) {
      if (cell.elements && cell.elements.length > 0) {
        overflowElements = overflowElements.concat(cell.elements);
      }
      continue;
    }
    const span = Math.min(cell.colSpan ?? 1, columnCount - spanned);
    result.push(span === (cell.colSpan ?? 1) ? cell : { ...cell, colSpan: span });
    spanned += span;
  }
  while (spanned < columnCount) {
    result.push(emptyCell());
    spanned += 1;
  }
  if (overflowElements.length > 0 && result.length > 0) {
    const last = result[result.length - 1];
    result[result.length - 1] = { ...last, elements: [...(last.elements ?? []), ...overflowElements] };
  }
  return result;
}

export function setColumnCount(spec: TableSpec, rawCount: number): TableSpec {
  const columnCount = Math.max(1, Math.min(MAX_TABLE_COLUMNS, Math.round(rawCount)));
  if (columnCount === spec.columnCount) return spec;
  return {
    ...spec,
    columnCount,
    columnWidthsPercent: spec.columnWidthsPercent ? evenColumnWidths(columnCount) : undefined,
    rows: spec.rows.map((row) => ({ ...row, cells: normalizeRow(row.cells, columnCount) })),
  };
}

export function setRowCount(spec: TableSpec, rawCount: number): TableSpec {
  const rowCount = Math.max(1, Math.min(MAX_TABLE_ROWS, Math.round(rawCount)));
  if (rowCount === spec.rows.length) return spec;
  if (rowCount < spec.rows.length) {
    return { ...spec, rows: spec.rows.slice(0, rowCount) };
  }
  const added = Array.from({ length: rowCount - spec.rows.length }, () => newTableRow(spec.columnCount));
  return { ...spec, rows: [...spec.rows, ...added] };
}

export function setCell(spec: TableSpec, rowIndex: number, cellIndex: number, patch: Partial<TableCell>): TableSpec {
  const row = spec.rows[rowIndex];
  if (!row || !row.cells[cellIndex]) return spec;
  const cells = row.cells.map((cell, index) => (index === cellIndex ? { ...cell, ...patch } : cell));
  const rows = spec.rows.map((r, index) => (index === rowIndex ? { ...row, cells } : r));
  return { ...spec, rows };
}

/**
 * Merges a cell with the one immediately after it in the same row (by array
 * index, not visual grid column - a cell's own `colSpan` already accounts
 * for how many grid columns it occupies) into a single cell whose `colSpan`
 * is the sum of both. Either cell's own `elements` (if any) are concatenated
 * onto the merged cell, in order, rather than the second cell's silently
 * disappearing. A no-op if there is no next cell to merge with.
 */
export function mergeCellWithNext(spec: TableSpec, rowIndex: number, cellIndex: number): TableSpec {
  const row = spec.rows[rowIndex];
  if (!row || cellIndex >= row.cells.length - 1) return spec;
  const current = row.cells[cellIndex];
  const next = row.cells[cellIndex + 1];
  const mergedElements = [...(current.elements ?? []), ...(next.elements ?? [])];
  const cells = row.cells.slice();
  cells.splice(cellIndex, 2, {
    ...current,
    colSpan: (current.colSpan ?? 1) + (next.colSpan ?? 1),
    elements: mergedElements.length > 0 ? mergedElements : undefined,
  });
  return { ...spec, rows: spec.rows.map((r, i) => (i === rowIndex ? { ...row, cells } : r)) };
}

/**
 * The inverse of `mergeCellWithNext`: takes one column back off a merged
 * cell's `colSpan` and gives it to a new empty cell inserted right after -
 * the row's total colspan is unchanged either way, so this never needs
 * `normalizeRow` to fix anything up. A no-op on an unmerged (colSpan 1) cell.
 */
export function splitCell(spec: TableSpec, rowIndex: number, cellIndex: number): TableSpec {
  const row = spec.rows[rowIndex];
  if (!row) return spec;
  const current = row.cells[cellIndex];
  const span = current.colSpan ?? 1;
  if (span <= 1) return spec;
  const cells = row.cells.slice();
  cells.splice(cellIndex, 1, { ...current, colSpan: span - 1 }, emptyCell());
  return { ...spec, rows: spec.rows.map((r, i) => (i === rowIndex ? { ...row, cells } : r)) };
}

export function distributeWidthsEvenly(spec: TableSpec): TableSpec {
  return { ...spec, columnWidthsPercent: evenColumnWidths(spec.columnCount) };
}

export function setColumnWidth(spec: TableSpec, columnIndex: number, value: number): TableSpec {
  const widths = spec.columnWidthsPercent ? spec.columnWidthsPercent.slice() : evenColumnWidths(spec.columnCount);
  widths[columnIndex] = value;
  return { ...spec, columnWidthsPercent: widths };
}

export function clearColumnWidths(spec: TableSpec): TableSpec {
  return { ...spec, columnWidthsPercent: undefined };
}
