import {
  ALLOWED_FONT_FAMILIES,
  LAYOUT_VERSION,
  type LayoutColumn,
  type LayoutElement,
  type LayoutRow,
  MAX_TABLE_CELL_TEXT_LENGTH,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  type ReportLayout,
  REPORT_BLOCK_NAMES,
  SIZABLE_BLOCKS,
  TABLE_BORDER_STYLES,
  type TableCell,
  type TableSpec,
  blockFitsMode,
} from "@/features/reporting/components/designer/layout";

/**
 * Client-side mirror of backend `reporting.domain.ReportLayoutValidator` -
 * every rule here has a matching one server-side, kept in sync deliberately
 * (see that class's Javadoc for the full rationale, including why this is a
 * security boundary and not just UX). This mirror exists purely to block
 * Save before a round trip to the server returns a 422 - the backend
 * validator is still the actual authority and is not bypassed by anything
 * accepted here.
 */

const MAX_ROWS = 60;
const MIN_COLUMNS_PER_ROW = 1;
const MAX_COLUMNS_PER_ROW = 3;
const REQUIRED_COLUMN_WIDTH_SUM = 100;
const MAX_TEXT_LENGTH = 2000;
const MIN_SPACER_HEIGHT_PX = 1;
const MAX_SPACER_HEIGHT_PX = 200;
const MIN_FONT_SIZE_PX = 8;
const MAX_FONT_SIZE_PX = 48;
const MAX_MARGIN_PX = 64;
const MAX_PADDING_PX = 64;
const MAX_IMAGE_DIMENSION_PX = 1000;
const MIN_BACKGROUND_OPACITY = 1;
const MAX_BACKGROUND_OPACITY = 100;
const MAX_TABLE_BORDER_WIDTH_PX = 8;
const MAX_TABLE_CELL_PADDING_PX = 24;
const REQUIRED_TABLE_COLUMN_WIDTH_SUM = 100;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ALIGNMENTS = new Set(["left", "center", "right"]);

export type AssessmentMode = "NUMERIC" | "QUALITATIVE";

/** Returns every validation error found, in no particular priority order - empty when the layout is save-ready. */
export function validateLayout(layout: ReportLayout, mode: AssessmentMode): string[] {
  const errors: string[] = [];
  if (layout.version !== LAYOUT_VERSION) {
    errors.push(`Unsupported layout version: ${layout.version}.`);
    return errors;
  }
  validatePage(layout, errors);
  validateRows(layout.rows, mode, errors);
  return errors;
}

export function isLayoutValid(layout: ReportLayout, mode: AssessmentMode): boolean {
  return validateLayout(layout, mode).length === 0;
}

function validatePage(layout: ReportLayout, errors: string[]) {
  const { page } = layout;
  requireRange(page.paddingPx, 0, MAX_PADDING_PX, "Page padding", errors);
  requireRange(page.fontSizePx, MIN_FONT_SIZE_PX, MAX_FONT_SIZE_PX, "Page font size", errors);
  requireColor(page.color, "Page text color", errors);
  if (!ALLOWED_FONT_FAMILIES.includes(page.fontFamily)) {
    errors.push(`Page font family must be one of: ${ALLOWED_FONT_FAMILIES.join(", ")}.`);
  }
  // logoBackground/logoBackgroundOpacity are optional together, unlike every field above -
  // a layout saved before this pair existed has neither set, and that must stay valid.
  requireRange(page.logoBackgroundOpacity, MIN_BACKGROUND_OPACITY, MAX_BACKGROUND_OPACITY, "Page background opacity", errors);
  if (page.logoBackground && page.logoBackgroundOpacity === undefined) {
    errors.push("Page background opacity is required when the school logo background is enabled.");
  }
}

function validateRows(rows: LayoutRow[], mode: AssessmentMode, errors: string[]) {
  if (!rows || rows.length === 0) {
    errors.push("A layout requires at least one row.");
    return;
  }
  if (rows.length > MAX_ROWS) {
    errors.push(`A layout may have at most ${MAX_ROWS} rows.`);
  }
  for (const row of rows) {
    validateRowStyle(row, errors);
    validateColumns(row.columns, mode, errors);
  }
}

function validateRowStyle(row: LayoutRow, errors: string[]) {
  const style = row.style;
  if (!style) return;
  requireRange(style.marginTopPx, 0, MAX_MARGIN_PX, "Row top margin", errors);
  requireRange(style.marginBottomPx, 0, MAX_MARGIN_PX, "Row bottom margin", errors);
  requireRange(style.paddingPx, 0, MAX_PADDING_PX, "Row padding", errors);
  if (style.backgroundColor !== undefined) {
    requireColor(style.backgroundColor, "Row background color", errors);
  }
}

function validateColumns(columns: LayoutColumn[], mode: AssessmentMode, errors: string[]) {
  if (!columns || columns.length < MIN_COLUMNS_PER_ROW || columns.length > MAX_COLUMNS_PER_ROW) {
    errors.push(`A row must have between ${MIN_COLUMNS_PER_ROW} and ${MAX_COLUMNS_PER_ROW} columns.`);
    return;
  }
  let widthSum = 0;
  for (const column of columns) {
    if (!Number.isInteger(column.widthPercent) || column.widthPercent < 1 || column.widthPercent > 100) {
      errors.push("A column width must be an integer percentage between 1 and 100.");
    } else {
      widthSum += column.widthPercent;
    }
    validateElements(column.elements, mode, false, errors);
  }
  if (widthSum !== REQUIRED_COLUMN_WIDTH_SUM) {
    errors.push(`A row's column widths must sum to 100 (got ${widthSum}).`);
  }
}

function validateElements(elements: LayoutElement[], mode: AssessmentMode, insideBox: boolean, errors: string[]) {
  for (const element of elements ?? []) {
    validateElement(element, mode, insideBox, errors);
  }
}

function validateElement(element: LayoutElement, mode: AssessmentMode, insideBox: boolean, errors: string[]) {
  validateElementStyle(element, errors);
  switch (element.type) {
    case "BLOCK": {
      if (!REPORT_BLOCK_NAMES.includes(element.block)) {
        errors.push(`Unknown block: ${element.block}.`);
      } else if (!blockFitsMode(element.block, mode)) {
        errors.push(`${element.block} may only be used on a ${mode === "NUMERIC" ? "QUALITATIVE" : "NUMERIC"} template.`);
      }
      validateBlockSizing(element, errors);
      break;
    }
    case "TEXT":
      if (element.text.length > MAX_TEXT_LENGTH) {
        errors.push(`A TEXT element may be at most ${MAX_TEXT_LENGTH} characters.`);
      }
      break;
    case "DIVIDER":
      break;
    case "SPACER":
      requireRange(element.heightPx, MIN_SPACER_HEIGHT_PX, MAX_SPACER_HEIGHT_PX, "Spacer height", errors);
      break;
    case "IMAGE":
      if (!element.fileId) {
        errors.push("An IMAGE element requires an uploaded image.");
      }
      if (element.maxWidthPx !== undefined) {
        requireRange(element.maxWidthPx, 1, MAX_IMAGE_DIMENSION_PX, "Image max width", errors);
      }
      if (element.maxHeightPx !== undefined) {
        requireRange(element.maxHeightPx, 1, MAX_IMAGE_DIMENSION_PX, "Image max height", errors);
      }
      break;
    case "BOX":
      if (insideBox) {
        errors.push("A BOX element may not contain another BOX.");
      } else {
        validateElements(element.elements, mode, true, errors);
      }
      break;
    case "TABLE":
      validateTable(element.table, errors);
      break;
  }
}

/** Mirrors backend `ReportLayoutValidator#validateTable` - a TABLE is mode-agnostic and may sit inside a BOX. */
function validateTable(table: TableSpec, errors: string[]) {
  requireRange(table.columnCount, 1, MAX_TABLE_COLUMNS, "Table column count", errors);
  const columnCount = table.columnCount;
  validateTableColumnWidths(table.columnWidthsPercent, columnCount, errors);
  requireRange(table.borderWidthPx, 0, MAX_TABLE_BORDER_WIDTH_PX, "Table border width", errors);
  if (table.borderStyle !== undefined && !TABLE_BORDER_STYLES.includes(table.borderStyle)) {
    errors.push(`Table border style must be one of: ${TABLE_BORDER_STYLES.join(", ")}.`);
  }
  if (table.borderColor !== undefined) {
    requireColor(table.borderColor, "Table border color", errors);
  }
  requireRange(table.cellPaddingPx, 0, MAX_TABLE_CELL_PADDING_PX, "Table cell padding", errors);
  if (table.headerBackgroundColor !== undefined) {
    requireColor(table.headerBackgroundColor, "Table header background color", errors);
  }
  if (!table.rows || table.rows.length === 0) {
    errors.push("A table requires at least one row.");
    return;
  }
  if (table.rows.length > MAX_TABLE_ROWS) {
    errors.push(`A table may have at most ${MAX_TABLE_ROWS} rows.`);
  }
  for (const row of table.rows) {
    validateTableRow(row.cells, columnCount, errors);
  }
}

function validateTableColumnWidths(widths: number[] | undefined, columnCount: number, errors: string[]) {
  if (widths === undefined) return;
  if (widths.length !== columnCount) {
    errors.push(`A table's column widths must have exactly ${columnCount} entries.`);
    return;
  }
  let sum = 0;
  for (const width of widths) {
    if (!Number.isInteger(width) || width < 1 || width > 100) {
      errors.push("A table column width must be an integer percentage between 1 and 100.");
    } else {
      sum += width;
    }
  }
  if (sum !== REQUIRED_TABLE_COLUMN_WIDTH_SUM) {
    errors.push(`A table's column widths must sum to 100 (got ${sum}).`);
  }
}

function validateTableRow(cells: TableCell[], columnCount: number, errors: string[]) {
  if (!cells || cells.length === 0) {
    errors.push("Every table row requires at least one cell.");
    return;
  }
  let spanned = 0;
  for (const cell of cells) {
    if (cell.text.length > MAX_TABLE_CELL_TEXT_LENGTH) {
      errors.push(`A table cell may be at most ${MAX_TABLE_CELL_TEXT_LENGTH} characters.`);
    }
    if (cell.align !== undefined && !ALIGNMENTS.has(cell.align)) {
      errors.push("Table cell alignment must be left, center, or right.");
    }
    if (cell.backgroundColor !== undefined) {
      requireColor(cell.backgroundColor, "Table cell background color", errors);
    }
    const colSpan = cell.colSpan ?? 1;
    if (colSpan < 1 || colSpan > columnCount) {
      errors.push(`A table cell's colspan must be between 1 and ${columnCount}.`);
    }
    spanned += colSpan;
  }
  if (spanned !== columnCount) {
    errors.push(`A table row's cells must span exactly ${columnCount} columns (got ${spanned}).`);
  }
}

/** Only a block in `SIZABLE_BLOCKS` may carry a size - mirrors backend `ReportLayoutValidator#validateBlockSizing`. */
function validateBlockSizing(element: Extract<LayoutElement, { type: "BLOCK" }>, errors: string[]) {
  const sizable = SIZABLE_BLOCKS.has(element.block);
  if (!sizable && (element.maxWidthPx !== undefined || element.maxHeightPx !== undefined)) {
    errors.push(`${element.block} may not specify a size.`);
  }
  if (element.maxWidthPx !== undefined) {
    requireRange(element.maxWidthPx, 1, MAX_IMAGE_DIMENSION_PX, "Block max width", errors);
  }
  if (element.maxHeightPx !== undefined) {
    requireRange(element.maxHeightPx, 1, MAX_IMAGE_DIMENSION_PX, "Block max height", errors);
  }
}

function validateElementStyle(element: LayoutElement, errors: string[]) {
  const style = element.style;
  if (!style) return;
  if (style.align !== undefined && !ALIGNMENTS.has(style.align)) {
    errors.push("Element alignment must be left, center, or right.");
  }
  requireRange(style.fontSizePx, MIN_FONT_SIZE_PX, MAX_FONT_SIZE_PX, "Element font size", errors);
  requireRange(style.marginTopPx, 0, MAX_MARGIN_PX, "Element top margin", errors);
  requireRange(style.marginBottomPx, 0, MAX_MARGIN_PX, "Element bottom margin", errors);
  requireRange(style.paddingPx, 0, MAX_PADDING_PX, "Element padding", errors);
  if (style.color !== undefined) {
    requireColor(style.color, "Element text color", errors);
  }
  if (style.backgroundColor !== undefined) {
    requireColor(style.backgroundColor, "Element background color", errors);
  }
}

function requireRange(value: number | undefined, min: number, max: number, field: string, errors: string[]) {
  if (value === undefined) return;
  if (value < min || value > max) {
    errors.push(`${field} must be between ${min} and ${max} (got ${value}).`);
  }
}

function requireColor(color: string, field: string, errors: string[]) {
  if (!HEX_COLOR.test(color)) {
    errors.push(`${field} must be a 6-digit hex color, e.g. #1a1a1a.`);
  }
}
