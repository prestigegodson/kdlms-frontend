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
  "SIGNATURE_IMAGE_CLASS_TEACHER",
  "SIGNATURE_IMAGE_PRINCIPAL",
  "REMARK_CLASS_TEACHER",
  "REMARK_PRINCIPAL",
  "HEAD_TITLE",
  "HEAD_NAME",
  "AFFECTIVE_TRAITS",
  "PSYCHOMOTOR_TRAITS",
  "TRAIT_LEGEND",
] as const;

export type ReportBlockName = (typeof REPORT_BLOCK_NAMES)[number];

/**
 * Mirrors backend `ReportLayoutValidator`'s font-family allowlist. The first
 * three are PDF base-14 fonts; the rest name a font bundled with the backend
 * (`shared.domain.EmbeddedFont`), each falling back to a base-14 font of the
 * same kind. `designerFonts.css` loads the bundled ones for the canvas.
 */
export const ALLOWED_FONT_FAMILIES = [
  "Helvetica, Arial, sans-serif",
  "Times New Roman, Times, serif",
  "Courier New, monospace",
  "Lato, Helvetica, Arial, sans-serif",
  "Merriweather, Times New Roman, Times, serif",
  "Noto Serif, Times New Roman, Times, serif",
] as const;

export type AllowedFontFamily = (typeof ALLOWED_FONT_FAMILIES)[number];

/** What the font picker shows for each allowed stack. */
export const FONT_FAMILY_LABELS: Record<AllowedFontFamily, string> = {
  "Helvetica, Arial, sans-serif": "Helvetica (clean sans-serif)",
  "Times New Roman, Times, serif": "Times (classic serif)",
  "Courier New, monospace": "Courier (typewriter)",
  "Lato, Helvetica, Arial, sans-serif": "Lato (modern sans-serif)",
  "Merriweather, Times New Roman, Times, serif": "Merriweather (formal serif)",
  "Noto Serif, Times New Roman, Times, serif": "Noto Serif (book serif)",
};

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
  /** Per-table override of `PageStyle.headerColors` - only accepted on a `TABLE_HEADER_BLOCKS` block or a TABLE element (and a TABLE has no band). */
  headerColors?: HeaderColors;
  /** Per-table override of `PageStyle.tableStyle` - only accepted on a `TABLE_STYLE_BLOCKS` block. */
  tableStyle?: TableStyle;
  /** Headline styling - only accepted on a `HEADING_BLOCKS` block. */
  heading?: HeadingStyle;
  /** A BOX's border while `border` is on - BOX only. Defaults: `#cccccc`. */
  borderColor?: string;
  /** 1-8, default 1. */
  borderWidthPx?: number;
  /** Default `solid`; `double` needs at least 3px. */
  borderStyle?: FrameStyle;
}

/** The CSS border a bordered BOX draws - mirrors backend `LayoutHtmlEmitter#boxElement`. */
export function boxBorderCss(style: ElementStyle | undefined): string | undefined {
  if (!style?.border) return undefined;
  return `${style.borderWidthPx ?? 1}px ${style.borderStyle ?? "solid"} ${style.borderColor ?? "#cccccc"}`;
}

/** Mirrors backend `ReportLayout.PageFrame` - a border on every printed page, carved out of `PageStyle.paddingPx` (so `widthPx + gapPx` must fit inside it). */
export interface PageFrame {
  widthPx: number;
  style: FrameStyle;
  color: string;
  gapPx?: number;
}

export const FRAME_STYLES = ["solid", "double", "dashed", "dotted"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

/** Mirrors backend `ReportLayout.CellPadding`. */
export const CELL_PADDINGS = ["COMPACT", "NORMAL", "ROOMY"] as const;
export type CellPadding = (typeof CELL_PADDINGS)[number];

/** CSS padding per `CellPadding` - mirrors backend `TemplateRenderer.TableTheme#cellPadding`. */
export const CELL_PADDING_CSS: Record<CellPadding, string> = {
  COMPACT: "2px 4px",
  NORMAL: "4px 6px",
  ROOMY: "7px 9px",
};

/**
 * The look of a platform block table's cells - mirrors backend
 * `ReportLayout.TableStyle`. Like `HeaderColors`, every field is optional and
 * resolves on its own: element override, then `PageStyle.tableStyle`, then
 * the platform default (`DEFAULT_TABLE_STYLE`).
 */
export interface TableStyle {
  borderColor?: string;
  /** 0-4; 0 removes cell borders. */
  borderWidthPx?: number;
  cellPadding?: CellPadding;
  /** 8-16. */
  fontSizePx?: number;
  /** Shades every other body row. */
  stripeColor?: string;
  /** Shades the first (label) column of every body row; wins over the stripe there. */
  labelBackground?: string;
}

/** The platform's own block-table look - mirrors backend `TemplateRenderer`'s defaults. Stripe and label shading default to none. */
export const DEFAULT_TABLE_STYLE = {
  borderColor: "#cccccc",
  borderWidthPx: 1,
  cellPadding: "NORMAL" as CellPadding,
  fontSizePx: 12,
};

/** Field-by-field `override ?? fallback` - an all-unset result collapses to `undefined`. */
export function mergeTableStyle(override?: TableStyle, fallback?: TableStyle): TableStyle | undefined {
  return compactStyle<TableStyle>({
    borderColor: override?.borderColor ?? fallback?.borderColor,
    borderWidthPx: override?.borderWidthPx ?? fallback?.borderWidthPx,
    cellPadding: override?.cellPadding ?? fallback?.cellPadding,
    fontSizePx: override?.fontSizePx ?? fallback?.fontSizePx,
    stripeColor: override?.stripeColor ?? fallback?.stripeColor,
    labelBackground: override?.labelBackground ?? fallback?.labelBackground,
  });
}

/**
 * The headline of a `HEADING_BLOCKS` block - the school name, or a remark's
 * label. Mirrors backend `ReportLayout.HeadingStyle`; every field falls back
 * to that block's own platform default. `subColor` is `SCHOOL_HEADER`'s
 * address/contact line only.
 */
export interface HeadingStyle {
  fontSizePx?: number;
  color?: string;
  uppercase?: boolean;
  /** 0-10. */
  letterSpacingPx?: number;
  subColor?: string;
}

/** Drops unset/empty fields, returning `undefined` when none remain - so a cleared override leaves no empty object in the saved layout. */
export function compactStyle<T extends object>(value?: T): T | undefined {
  if (!value) return undefined;
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== "" && v !== false);
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined;
}

/**
 * Background/text colours for a table's two header levels - the main column
 * `header` row, and the `band`: the subject-group row on a score/rating table,
 * or the title row on an affective/psychomotor table. Mirrors backend
 * `ReportLayout.HeaderColors`. Every field is optional and resolves on its own:
 * element override, then the page default, then the platform grey (background)
 * or inherited text colour.
 */
export interface HeaderColors {
  headerBackground?: string;
  headerText?: string;
  bandBackground?: string;
  bandText?: string;
}

/** The platform's own header colours when nothing is set - mirrors backend `TemplateRenderer`'s defaults. */
export const DEFAULT_HEADER_BACKGROUND = "#f2f2f2";
export const DEFAULT_BAND_BACKGROUND = "#e8e8e8";

/** Field-by-field `override ?? fallback` - an all-unset result collapses to `undefined`. */
export function mergeHeaderColors(override?: HeaderColors, fallback?: HeaderColors): HeaderColors | undefined {
  const merged: HeaderColors = {
    headerBackground: override?.headerBackground ?? fallback?.headerBackground,
    headerText: override?.headerText ?? fallback?.headerText,
    bandBackground: override?.bandBackground ?? fallback?.bandBackground,
    bandText: override?.bandText ?? fallback?.bandText,
  };
  return compactHeaderColors(merged);
}

/** The colours a table header actually renders with: `override`, then the page default, then the platform default - mirrors backend `LayoutHtmlEmitter`/`TemplateRenderer`. Text falls back to the page's own text colour, which is what it inherits. */
export function resolveHeaderColors(page: PageStyle, override?: HeaderColors): Required<HeaderColors> {
  const merged = mergeHeaderColors(override, page.headerColors);
  return {
    headerBackground: merged?.headerBackground ?? DEFAULT_HEADER_BACKGROUND,
    headerText: merged?.headerText ?? page.color,
    bandBackground: merged?.bandBackground ?? DEFAULT_BAND_BACKGROUND,
    bandText: merged?.bandText ?? page.color,
  };
}

/** Drops unset fields, returning `undefined` when none remain - so a cleared override leaves no empty object in the saved layout. */
export function compactHeaderColors(colors?: HeaderColors): HeaderColors | undefined {
  if (!colors) return undefined;
  const entries = Object.entries(colors).filter(([, value]) => value !== undefined && value !== "");
  return entries.length > 0 ? (Object.fromEntries(entries) as HeaderColors) : undefined;
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
/** Mirrors backend `ReportLayoutValidator#MAX_TABLE_CELL_ELEMENTS`. */
export const MAX_TABLE_CELL_ELEMENTS = 10;
/** A table cell may not host another grid or an indefinitely-nesting box - mirrors backend `ReportLayoutValidator#validateTableCellElements`. */
export const CELL_FORBIDDEN_TYPES: ReadonlySet<LayoutElement["type"]> = new Set(["BOX", "TABLE"]);

export interface TableCell {
  text: string;
  align?: ElementAlign;
  bold?: boolean;
  backgroundColor?: string;
  /** Defaults to 1. Every row's cells must span exactly the table's `columnCount`. */
  colSpan?: number;
  /**
   * Elements the cell carries underneath its own `text` - one level deep,
   * like a `BOX`'s own `elements`, but narrower: never a `BOX` or another
   * `TABLE` (see `CELL_FORBIDDEN_TYPES`). Absent/empty means none.
   */
  elements?: LayoutElement[];
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
  /** Colour of whichever of `borderTop`/`borderBottom` is on - defaults to `#cccccc`. */
  borderColor?: string;
  /** 1-6 - defaults to 1. */
  borderWidthPx?: number;
}

/** Mirrors backend `reporting.domain.ReportConditionFlag` - the vocabulary a row's visibility condition (and, independently, the renderer's own blank-block pruning) is built from. Keep this list in exact sync with that enum. */
export const REPORT_CONDITION_FLAGS = [
  "HAS_CLASS_TEACHER_REMARK",
  "HAS_PRINCIPAL_REMARK",
  "HAS_STUDENT_PHOTO",
  "HAS_SCHOOL_LOGO",
  "HAS_CLASS_TEACHER_SIGNATURE",
  "HAS_PRINCIPAL_SIGNATURE",
  "HAS_RESULT_POSITION",
  "HAS_PERCENTAGE_GRADE",
  "IS_MIDTERM",
  "HAS_AFFECTIVE_TRAITS",
  "HAS_PSYCHOMOTOR_TRAITS",
  "HAS_TRAIT_SCALE",
  "HAS_HEAD_NAME",
] as const;

export type ReportConditionFlag = (typeof REPORT_CONDITION_FLAGS)[number];

export const CONDITION_MATCHES = ["ALL", "ANY"] as const;
export type ConditionMatch = (typeof CONDITION_MATCHES)[number];

/** Mirrors backend `ReportLayoutValidator`'s `MAX_CONDITION_RULES`. */
export const MAX_CONDITION_RULES = 5;

/**
 * `expected` is nullable (absent) on the wire, defaulting to `true` - see
 * backend `ReportLayout.ConditionRule`'s Javadoc for why it's a boxed
 * boolean rather than a primitive with a `false` default.
 */
export interface ConditionRule {
  flag: ReportConditionFlag;
  expected?: boolean;
}

/** A row's visibility rule - `null`/absent on a `LayoutRow` always means "always visible." `rules` must be non-empty whenever `condition` itself is present; the inspector clears the whole object rather than ever producing an empty list. */
export interface RowCondition {
  match: ConditionMatch;
  rules: ConditionRule[];
}

export interface LayoutRow {
  id: string;
  style?: RowStyle;
  /** Absent (or `undefined`) means the row is always shown - see `RowCondition`. */
  condition?: RowCondition;
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
  /** Template-wide default table header colours - see `HeaderColors`. Absent means the platform grey. */
  headerColors?: HeaderColors;
  /** A border around every printed page - see `PageFrame`. Absent means none. */
  frame?: PageFrame;
  /** Template-wide default block-table look - see `TableStyle`. Absent means the platform default. */
  tableStyle?: TableStyle;
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
  STUDENT_BIO: "Pupil bio",
  STUDENT_PHOTO: "Pupil photo",
  SCORE_TABLE: "Score table",
  RATING_TABLE: "Rating table",
  ATTENDANCE_SUMMARY: "Attendance summary",
  GRADE_KEY: "Grade key",
  RATING_LEGEND: "Rating legend",
  SIGNATURE_CLASS_TEACHER: "Class teacher signature",
  SIGNATURE_PRINCIPAL: "Principal signature",
  SIGNATURE_IMAGE_CLASS_TEACHER: "Class teacher signature (image only)",
  SIGNATURE_IMAGE_PRINCIPAL: "Principal signature (image only)",
  REMARK_CLASS_TEACHER: "Class teacher's remark",
  REMARK_PRINCIPAL: "Principal's remark",
  HEAD_TITLE: "Remark commenter title",
  HEAD_NAME: "Remark commenter name",
  AFFECTIVE_TRAITS: "Affective disposition table",
  PSYCHOMOTOR_TRAITS: "Psychomotor skills table",
  TRAIT_LEGEND: "Behavioural traits key",
};

/**
 * Noun-phrase labels for every flag, so a stored condition always renders
 * legibly - even for a flag `SELECTABLE_CONDITION_FLAGS` doesn't (yet) offer
 * in the dropdown, e.g. one authored by a future version of this app.
 */
export const CONDITION_FLAG_LABELS: Record<ReportConditionFlag, string> = {
  HAS_CLASS_TEACHER_REMARK: "Class teacher's remark",
  HAS_PRINCIPAL_REMARK: "Principal's remark",
  HAS_STUDENT_PHOTO: "Pupil photo",
  HAS_SCHOOL_LOGO: "School logo",
  HAS_CLASS_TEACHER_SIGNATURE: "Class teacher signature",
  HAS_PRINCIPAL_SIGNATURE: "Principal signature",
  HAS_RESULT_POSITION: "Class position",
  HAS_PERCENTAGE_GRADE: "Percentage & grade",
  IS_MIDTERM: "Mid-term result",
  HAS_AFFECTIVE_TRAITS: "Affective ratings",
  HAS_PSYCHOMOTOR_TRAITS: "Psychomotor ratings",
  HAS_TRAIT_SCALE: "Behavioural traits key",
  HAS_HEAD_NAME: "Remark commenter name",
};

/** `IS_*`-shaped flags read as "Yes"/"No" in the inspector rather than "Present"/"Not present" - "Mid-term result / Yes" reads naturally, "Mid-term result / Present" doesn't. */
const YES_NO_FLAGS: ReadonlySet<ReportConditionFlag> = new Set(["IS_MIDTERM"]);

export function conditionRulePolarityLabel(flag: ReportConditionFlag, expected: boolean | undefined): string {
  const isTrue = expected !== false;
  if (YES_NO_FLAGS.has(flag)) return isTrue ? "Yes" : "No";
  return isTrue ? "Present" : "Not present";
}

/**
 * The flags the inspector's dropdown offers, deliberately narrower than
 * `REPORT_CONDITION_FLAGS` - the trait flags exist so the renderer's own
 * blank-block prune table and an author's own row conditions share one
 * vocabulary, but aren't author-facing yet. Widen this constant, not the
 * enum, when they should be.
 */
export const SELECTABLE_CONDITION_FLAGS: readonly ReportConditionFlag[] = [
  "HAS_CLASS_TEACHER_REMARK",
  "HAS_PRINCIPAL_REMARK",
  "IS_MIDTERM",
  "HAS_STUDENT_PHOTO",
  "HAS_SCHOOL_LOGO",
  "HAS_CLASS_TEACHER_SIGNATURE",
  "HAS_PRINCIPAL_SIGNATURE",
  "HAS_RESULT_POSITION",
  "HAS_PERCENTAGE_GRADE",
];

/** One-line summary shared by the inspector header, `RowShell`'s badge tooltip, and their tests. */
export function describeRowCondition(condition: RowCondition): string {
  const joiner = condition.match === "ANY" ? " or " : " and ";
  const clauses = condition.rules.map(
    (rule) => `${CONDITION_FLAG_LABELS[rule.flag]}: ${conditionRulePolarityLabel(rule.flag, rule.expected)}`,
  );
  return clauses.join(joiner);
}

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

/** Blocks that render a platform-owned table with a header row, and so accept `ElementStyle.headerColors` - mirrors backend `ReportBlock#hasTableHeader`. */
export const TABLE_HEADER_BLOCKS: ReadonlySet<ReportBlockName> = new Set([
  "SCORE_TABLE",
  "RATING_TABLE",
  "GRADE_KEY",
  "RATING_LEGEND",
  "AFFECTIVE_TRAITS",
  "PSYCHOMOTOR_TRAITS",
  "TRAIT_LEGEND",
]);

/** Blocks whose cells take a `TableStyle` - every `TABLE_HEADER_BLOCKS` block plus the attendance summary. Mirrors backend `ReportBlock#acceptsTableStyle`. */
export const TABLE_STYLE_BLOCKS: ReadonlySet<ReportBlockName> = new Set([...TABLE_HEADER_BLOCKS, "ATTENDANCE_SUMMARY"]);

/** Blocks that print a platform headline and accept a `HeadingStyle` - mirrors backend `ReportBlock#hasHeading`. */
export const HEADING_BLOCKS: ReadonlySet<ReportBlockName> = new Set(["SCHOOL_HEADER", "REMARK_CLASS_TEACHER", "REMARK_PRINCIPAL"]);

/** Of `TABLE_HEADER_BLOCKS`, the ones that also print a band row (subject group or trait title) - the keys/legends have only a header row. */
export const BANDED_TABLE_BLOCKS: ReadonlySet<ReportBlockName> = new Set([
  "SCORE_TABLE",
  "RATING_TABLE",
  "AFFECTIVE_TRAITS",
  "PSYCHOMOTOR_TRAITS",
]);

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
