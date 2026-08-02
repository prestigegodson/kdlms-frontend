import {
  LAYOUT_VERSION,
  type LayoutElement,
  type ReportLayout,
  type ReportBlockName,
  newElementId,
} from "@/features/reporting/components/designer/layout";

/**
 * Prebuilt layouts a system admin starts a new template from - this is the
 * app's substitute for the DB-seeded system templates the old GrapesJS
 * designer shipped with (see `V19__replace_template_markup_with_layout_json.sql`'s
 * header for why nothing is seeded server-side anymore). A hand-authored
 * layout here is type-checked against `ReportLayout` and covered by
 * `starterLayouts.test.ts` asserting every preset passes `validateLayout` -
 * the DB-seeded stub it replaces had no such guarantee and had already
 * drifted from what it was supposed to render.
 */

const DEFAULT_PAGE = {
  paddingPx: 24,
  fontFamily: "Helvetica, Arial, sans-serif" as const,
  fontSizePx: 12,
  color: "#1a1a1a",
};

function blockElement(block: ReportBlockName): LayoutElement {
  return { id: newElementId("el"), type: "BLOCK", block };
}

function fullWidthRow(elements: LayoutElement[]) {
  return {
    id: newElementId("row"),
    columns: [{ id: newElementId("col"), widthPercent: 100, elements }],
  };
}

function twoColumnRow(leftPercent: number, left: LayoutElement[], right: LayoutElement[]) {
  return {
    id: newElementId("row"),
    columns: [
      { id: newElementId("col"), widthPercent: leftPercent, elements: left },
      { id: newElementId("col"), widthPercent: 100 - leftPercent, elements: right },
    ],
  };
}

export function buildBlankLayout(): ReportLayout {
  return {
    version: LAYOUT_VERSION,
    page: { ...DEFAULT_PAGE },
    rows: [fullWidthRow([])],
  };
}

/** Reproduces the old V18-seeded "Standard result sheet" template's arrangement. */
export function buildStandardResultSheetLayout(): ReportLayout {
  return {
    version: LAYOUT_VERSION,
    page: { ...DEFAULT_PAGE },
    rows: [
      fullWidthRow([blockElement("SCHOOL_HEADER")]),
      fullWidthRow([{ id: newElementId("el"), type: "DIVIDER" }]),
      fullWidthRow([blockElement("STUDENT_BIO")]),
      twoColumnRow(65, [blockElement("SCORE_TABLE")], [blockElement("ATTENDANCE_SUMMARY")]),
      fullWidthRow([blockElement("GRADE_KEY")]),
      twoColumnRow(50, [blockElement("SIGNATURE_CLASS_TEACHER")], [blockElement("SIGNATURE_PRINCIPAL")]),
    ],
  };
}

/** Reproduces the old V18-seeded "Early years progress report" template's arrangement. */
export function buildEarlyYearsProgressReportLayout(): ReportLayout {
  return {
    version: LAYOUT_VERSION,
    page: { ...DEFAULT_PAGE },
    rows: [
      fullWidthRow([blockElement("SCHOOL_HEADER")]),
      fullWidthRow([{ id: newElementId("el"), type: "DIVIDER" }]),
      fullWidthRow([blockElement("STUDENT_BIO")]),
      twoColumnRow(65, [blockElement("RATING_TABLE")], [blockElement("ATTENDANCE_SUMMARY")]),
      fullWidthRow([blockElement("RATING_LEGEND")]),
      twoColumnRow(50, [blockElement("SIGNATURE_CLASS_TEACHER")], [blockElement("SIGNATURE_PRINCIPAL")]),
    ],
  };
}

export interface StarterLayoutOption {
  id: string;
  label: string;
  /** Which assessment mode this starter is offered for - "ANY" (Blank) is offered regardless. */
  mode: "NUMERIC" | "QUALITATIVE" | "ANY";
  build: () => ReportLayout;
}

export const STARTER_LAYOUTS: StarterLayoutOption[] = [
  { id: "blank", label: "Blank", mode: "ANY", build: buildBlankLayout },
  { id: "standard-result-sheet", label: "Standard result sheet", mode: "NUMERIC", build: buildStandardResultSheetLayout },
  {
    id: "early-years-progress-report",
    label: "Early years progress report",
    mode: "QUALITATIVE",
    build: buildEarlyYearsProgressReportLayout,
  },
];

export function starterLayoutsForMode(mode: "NUMERIC" | "QUALITATIVE"): StarterLayoutOption[] {
  return STARTER_LAYOUTS.filter((option) => option.mode === "ANY" || option.mode === mode);
}
