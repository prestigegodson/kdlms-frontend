import type { BroadsheetView } from "@/api/assessments";
import type { ResultScope } from "@/api/types";
import { classAverageCellText, scoreCellText, scoreHeader } from "@/features/assessments/finalScore";

type BroadsheetRow = BroadsheetView["rows"][number];
type BroadsheetSubjectResult = BroadsheetRow["subjectResults"][number];

/** What BroadsheetTable and the CSV export both derive from a broadsheet, kept in one place so they never disagree on columns or order. */
export interface BroadsheetLayout {
  isNumeric: boolean;
  /** Total/Average/Position columns - a MIDTERM result is never a term aggregate or a ranking (see CLAUDE.md's ResultScope domain rule). */
  showsAggregates: boolean;
  /** Undefined class averages unless the school's "Show class average per subject" opt-in is on - rides both scopes, since it's a subject-axis figure. */
  showClassAverage: boolean;
  /** Position order when aggregates show, else the server's order. */
  rows: BroadsheetRow[];
  /** A MIDTERM subject's raw-mark denominator, uniform across the class - printed once in the header ("MTH (20)"). */
  scoreMaxFor: (subjectId: string) => number | undefined;
}

export function broadsheetLayout(broadsheet: BroadsheetView, scope: ResultScope = "TERM"): BroadsheetLayout {
  const isNumeric = broadsheet.assessmentMode === "NUMERIC";
  const showsAggregates = isNumeric && scope === "TERM";
  const rows = showsAggregates
    ? [...broadsheet.rows].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
    : broadsheet.rows;
  const showClassAverage = isNumeric && broadsheet.subjects.some((subject) => subject.classAverage != null);
  // Reused from whichever row happens to carry it - the same assumption the
  // backend's own class-average computation makes.
  const scoreMaxFor = (subjectId: string) =>
    broadsheet.rows
      .map((row) => row.subjectResults.find((result) => result.subjectId === subjectId)?.scoreMax)
      .find((scoreMax) => scoreMax != null);
  return { isNumeric, showsAggregates, showClassAverage, rows, scoreMaxFor };
}

/** A subject cell as the CSV shows it: the score plus its grade in brackets, or the rating label for a QUALITATIVE class. */
function subjectCellText(result: BroadsheetSubjectResult | undefined, isNumeric: boolean, headerMax: number | undefined): string {
  if (!isNumeric) {
    return result?.ratingLabel ?? "—";
  }
  const score = scoreCellText(result, headerMax);
  return result?.grade ? `${score} (${result.grade})` : score;
}

function csvField(value: string | number | undefined | null): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The broadsheet as CSV, column-for-column with BroadsheetTable (plus a
 * separate Admission no. column the table stacks under the name). Prefixed
 * with a UTF-8 BOM so Excel doesn't mangle accented names.
 */
export function broadsheetToCsv(broadsheet: BroadsheetView, scope: ResultScope = "TERM"): string {
  const { isNumeric, showsAggregates, showClassAverage, rows, scoreMaxFor } = broadsheetLayout(broadsheet, scope);
  const subjectHeaders = broadsheet.subjects.map((subject) =>
    isNumeric ? scoreHeader(subject.code || subject.name, scoreMaxFor(subject.subjectId)) : subject.code || subject.name,
  );
  const lines: Array<Array<string | number | undefined>> = [
    ["Pupil", "Admission no.", ...subjectHeaders, ...(showsAggregates ? ["Total", "Average", "Position"] : [])],
  ];
  for (const row of rows) {
    const resultBySubject = new Map(row.subjectResults.map((result) => [result.subjectId, result]));
    lines.push([
      row.studentName,
      row.admissionNumber,
      ...broadsheet.subjects.map((subject) =>
        subjectCellText(resultBySubject.get(subject.subjectId), isNumeric, scoreMaxFor(subject.subjectId)),
      ),
      ...(showsAggregates ? [row.total ?? "—", row.average ?? "—", row.position ?? "—"] : []),
    ]);
  }
  if (showClassAverage) {
    lines.push([
      "Class average",
      "",
      ...broadsheet.subjects.map((subject) =>
        classAverageCellText(subject.classAverage, scoreMaxFor(subject.subjectId), scoreMaxFor(subject.subjectId)),
      ),
      ...(showsAggregates ? ["", "", ""] : []),
    ]);
  }
  return "﻿" + lines.map((line) => line.map(csvField).join(",")).join("\r\n") + "\r\n";
}

/** A printed broadsheet's heading: "Primary 1A - 2026/2027, First Term (Mid-term)". */
export function broadsheetPrintTitle(
  className: string,
  labels: { sessionName?: string; termName?: string },
  scope: ResultScope,
): string {
  const period = [labels.sessionName, labels.termName].filter(Boolean).join(", ");
  const heading = [className || "Broadsheet", period].filter(Boolean).join(" - ");
  return scope === "MIDTERM" ? `${heading} (Mid-term)` : heading;
}
