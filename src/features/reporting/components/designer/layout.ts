/**
 * The document model the layout designer canvas edits - mirrors backend
 * `reporting.domain.ReportLayout` field for field. This is the single
 * source of truth persisted on a template; the backend's `LayoutHtmlEmitter`
 * is the only thing that turns it into HTML, so this file never grows a
 * `toHtml()` of its own - see `TemplateDesignerPage`'s save-then-preview
 * flow for why the canvas only ever approximates and `GET .../preview` is
 * truth.
 * <p>
 * One deliberate asymmetry from the backend: `reporting.domain.ReportLayout.Element`
 * is a single flat record with nullable variant fields (to keep Jackson
 * polymorphic annotations out of the domain package); here on the frontend
 * there's no such constraint, so `LayoutElement` is a proper TypeScript
 * discriminated union on `type`. Keep both mirrors in sync when this
 * changes.
 */
export const LAYOUT_VERSION = 1;

/** Mirrors backend `reporting.domain.ReportBlock` - keep this list in exact sync with that enum. */
export const REPORT_BLOCK_NAMES = [
  "SCHOOL_HEADER",
  "SCHOOL_LOGO",
  "STUDENT_BIO",
  "STUDENT_PHOTO",
  "SCORE_TABLE",
  "RATING_TABLE",
  "ATTENDANCE_SUMMARY",
  "GRADE_KEY",
  "RATING_LEGEND",
  "SIGNATURE_CLASS_TEACHER",
  "SIGNATURE_PRINCIPAL",
  "REMARK_CLASS_TEACHER",
  "REMARK_PRINCIPAL",
  "AFFECTIVE_TRAITS",
  "PSYCHOMOTOR_TRAITS",
  "TRAIT_LEGEND",
] as const;

export type ReportBlockName = (typeof REPORT_BLOCK_NAMES)[number];

/** Mirrors backend `ReportLayoutValidator`'s font-family allowlist - every value here maps onto a PDF base-14 font that renders without registration. */
export const ALLOWED_FONT_FAMILIES = [
  "Helvetica, Arial, sans-serif",
  "Times New Roman, Times, serif",
  "Courier New, monospace",
] as const;

export type AllowedFontFamily = (typeof ALLOWED_FONT_FAMILIES)[number];

export type ElementAlign = "left" | "center" | "right";

export interface ElementStyle {
  align?: ElementAlign;
  bold?: boolean;
  italic?: boolean;
  fontSizePx?: number;
  color?: string;
  marginTopPx?: number;
  marginBottomPx?: number;
  paddingPx?: number;
  backgroundColor?: string;
  border?: boolean;
}

interface BaseElement {
  id: string;
  style?: ElementStyle;
}

export interface BlockElement extends BaseElement {
  type: "BLOCK";
  block: ReportBlockName;
  /** Only meaningful (and only accepted server-side) for a block in `SIZABLE_BLOCKS` - every other block's interior is entirely platform-owned. */
  maxWidthPx?: number;
  maxHeightPx?: number;
}

export interface TextElement extends BaseElement {
  type: "TEXT";
  /** May reference any `{{token}}` from `REPORT_TOKENS` - substituted server-side, never here. */
  text: string;
}

export interface DividerElement extends BaseElement {
  type: "DIVIDER";
}

export interface SpacerElement extends BaseElement {
  type: "SPACER";
  heightPx: number;
}

export interface ImageElement extends BaseElement {
  type: "IMAGE";
  fileId: string;
  maxWidthPx?: number;
  maxHeightPx?: number;
}

export interface BoxElement extends BaseElement {
  type: "BOX";
  /** A BOX may not contain another BOX - enforced by `layoutValidation.ts` and mirrored server-side. */
  elements: LayoutElement[];
}

export type TableBorderStyle = "solid" | "dashed" | "dotted" | "none";

/** Mirrors backend `ReportLayoutValidator`'s table border-style allowlist. */
export const TABLE_BORDER_STYLES: readonly TableBorderStyle[] = ["solid", "dashed", "dotted", "none"];

export const MAX_TABLE_ROWS = 30;
export const MAX_TABLE_COLUMNS = 8;
export const MAX_TABLE_CELL_TEXT_LENGTH = 500;
export const MAX_TABLE_BORDER_WIDTH_PX = 8;
export const MAX_TABLE_CELL_PADDING_PX = 24;

export interface TableCell {
  text: string;
  align?: ElementAlign;
  bold?: boolean;
  backgroundColor?: string;
  /** Defaults to 1. Every row's cells must span exactly the table's `columnCount`. */
  colSpan?: number;
}

export interface TableRow {
  id: string;
  cells: TableCell[];
}

/**
 * A designer-defined grid - the one element whose *content* is the
 * designer's own free text (which may include `{{token}}`s) rather than
 * platform-generated, unlike every semantic block. `columnWidthsPercent` is
 * optional: absent, the emitted `table-layout:fixed` splits columns evenly;
 * present, it must have exactly `columnCount` entries summing to 100.
 */
export interface TableSpec {
  columnCount: number;
  columnWidthsPercent?: number[];
  headerRow?: boolean;
  borderWidthPx?: number;
  borderStyle?: TableBorderStyle;
  borderColor?: string;
  cellPaddingPx?: number;
  headerBackgroundColor?: string;
  rows: TableRow[];
}

export interface TableElement extends BaseElement {
  type: "TABLE";
  table: TableSpec;
}

export type LayoutElement =
  | BlockElement
  | TextElement
  | DividerElement
  | SpacerElement
  | ImageElement
  | BoxElement
  | TableElement;

export interface LayoutColumn {
  id: string;
  widthPercent: number;
  elements: LayoutElement[];
}

export interface RowStyle {
  marginTopPx?: number;
  marginBottomPx?: number;
  paddingPx?: number;
  backgroundColor?: string;
  borderTop?: boolean;
  borderBottom?: boolean;
}

export interface LayoutRow {
  id: string;
  style?: RowStyle;
  columns: LayoutColumn[];
}

export interface PageStyle {
  paddingPx: number;
  fontFamily: AllowedFontFamily;
  fontSizePx: number;
  color: string;
  /**
   * Watermark the page with the rendering school's own logo - optional,
   * unlike every field above, since a layout saved before this feature
   * existed has neither field set. The *image* is never the designer's to
   * supply (a template is shared across schools); a school with no logo on
   * file simply renders with no background.
   */
  logoBackground?: boolean;
  /** 1-100. Required when `logoBackground` is true - mirrors backend `ReportLayoutValidator`. */
  logoBackgroundOpacity?: number;
}

export interface ReportLayout {
  version: number;
  page: PageStyle;
  rows: LayoutRow[];
}

/** The block/element labels the palette and inspector show - kept alongside the type definitions since both read from it. */
export const BLOCK_LABELS: Record<ReportBlockName, string> = {
  SCHOOL_HEADER: "School header",
  SCHOOL_LOGO: "School logo",
  STUDENT_BIO: "Student bio",
  STUDENT_PHOTO: "Student photo",
  SCORE_TABLE: "Score table",
  RATING_TABLE: "Rating table",
  ATTENDANCE_SUMMARY: "Attendance summary",
  GRADE_KEY: "Grade key",
  RATING_LEGEND: "Rating legend",
  SIGNATURE_CLASS_TEACHER: "Class teacher signature",
  SIGNATURE_PRINCIPAL: "Principal signature",
  REMARK_CLASS_TEACHER: "Class teacher's remark",
  REMARK_PRINCIPAL: "Principal's remark",
  AFFECTIVE_TRAITS: "Affective disposition table",
  PSYCHOMOTOR_TRAITS: "Psychomotor skills table",
  TRAIT_LEGEND: "Behavioural traits key",
};

/** Only these four blocks are mode-specific - every other block (and every non-BLOCK element) is offered regardless of assessment mode. */
export const NUMERIC_ONLY_BLOCKS: ReadonlySet<ReportBlockName> = new Set(["SCORE_TABLE", "GRADE_KEY"]);
export const QUALITATIVE_ONLY_BLOCKS: ReadonlySet<ReportBlockName> = new Set(["RATING_TABLE", "RATING_LEGEND"]);

export function blockFitsMode(block: ReportBlockName, mode: "NUMERIC" | "QUALITATIVE"): boolean {
  if (NUMERIC_ONLY_BLOCKS.has(block)) return mode === "NUMERIC";
  if (QUALITATIVE_ONLY_BLOCKS.has(block)) return mode === "QUALITATIVE";
  return true;
}

/** The only two blocks whose interior sizing the designer controls - mirrors backend `ReportLayoutValidator`'s `SIZABLE_BLOCKS`. Every other block rejects `maxWidthPx`/`maxHeightPx` at save time. */
export const SIZABLE_BLOCKS: ReadonlySet<ReportBlockName> = new Set(["STUDENT_PHOTO", "SCHOOL_LOGO"]);

/** Seeded default size/caption for a new `SIZABLE_BLOCKS` instance - mirrors backend `TemplateRenderer`'s `DEFAULT_PHOTO_*`/`DEFAULT_LOGO_*` constants and placeholder captions. */
export const BLOCK_DEFAULT_SIZE: Partial<Record<ReportBlockName, { maxWidthPx: number; maxHeightPx: number; caption: string }>> = {
  STUDENT_PHOTO: { maxWidthPx: 96, maxHeightPx: 120, caption: "Photo" },
  SCHOOL_LOGO: { maxWidthPx: 96, maxHeightPx: 96, caption: "Logo" },
};

let idCounter = 0;

/** A short, collision-safe-enough id for a new row/column/element - only ever compared within one designer session, never persisted as a lookup key elsewhere. */
export function newElementId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
