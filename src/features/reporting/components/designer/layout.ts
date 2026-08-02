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
  "STUDENT_BIO",
  "SCORE_TABLE",
  "RATING_TABLE",
  "ATTENDANCE_SUMMARY",
  "GRADE_KEY",
  "RATING_LEGEND",
  "SIGNATURE_CLASS_TEACHER",
  "SIGNATURE_PRINCIPAL",
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

export type LayoutElement = BlockElement | TextElement | DividerElement | SpacerElement | ImageElement | BoxElement;

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
}

export interface ReportLayout {
  version: number;
  page: PageStyle;
  rows: LayoutRow[];
}

/** The block/element labels the palette and inspector show - kept alongside the type definitions since both read from it. */
export const BLOCK_LABELS: Record<ReportBlockName, string> = {
  SCHOOL_HEADER: "School header",
  STUDENT_BIO: "Student bio",
  SCORE_TABLE: "Score table",
  RATING_TABLE: "Rating table",
  ATTENDANCE_SUMMARY: "Attendance summary",
  GRADE_KEY: "Grade key",
  RATING_LEGEND: "Rating legend",
  SIGNATURE_CLASS_TEACHER: "Class teacher signature",
  SIGNATURE_PRINCIPAL: "Principal signature",
};

/** Only these four blocks are mode-specific - every other block (and every non-BLOCK element) is offered regardless of assessment mode. */
export const NUMERIC_ONLY_BLOCKS: ReadonlySet<ReportBlockName> = new Set(["SCORE_TABLE", "GRADE_KEY"]);
export const QUALITATIVE_ONLY_BLOCKS: ReadonlySet<ReportBlockName> = new Set(["RATING_TABLE", "RATING_LEGEND"]);

export function blockFitsMode(block: ReportBlockName, mode: "NUMERIC" | "QUALITATIVE"): boolean {
  if (NUMERIC_ONLY_BLOCKS.has(block)) return mode === "NUMERIC";
  if (QUALITATIVE_ONLY_BLOCKS.has(block)) return mode === "QUALITATIVE";
  return true;
}

let idCounter = 0;

/** A short, collision-safe-enough id for a new row/column/element - only ever compared within one designer session, never persisted as a lookup key elsewhere. */
export function newElementId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
