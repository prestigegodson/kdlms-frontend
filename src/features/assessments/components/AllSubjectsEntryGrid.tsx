import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useBlocker } from "react-router";
import {
  type CellOutcome,
  type ClassAssessmentSheetView,
  type ClassSheetCell,
  saveClassRatings,
  saveClassScores,
} from "@/api/assessments";
import { ApiError } from "@/api/client";
import type { ResultScope } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { groupSubjects } from "@/features/academics/subjectTarget";
import { ScopeToggle } from "@/features/assessments/components/ScopeToggle";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

type SheetSubject = ClassAssessmentSheetView["subjects"][number];

/**
 * Pins a header cell to the top of the grid's scroll box. The background and inset bottom rule sit
 * on the `th` itself - the thead's own background and border don't travel with sticky cells.
 */
const STICKY_HEADER_CELL = "sticky top-0 bg-slate-50 shadow-[inset_0_-1px_0_theme(colors.slate.200)]";

/** A (student, subject) cell's draft key - enrollment and subject ids are UUIDs, so `:` never collides. */
function cellKey(enrollmentId: string, subjectId: string): string {
  return `${enrollmentId}:${subjectId}`;
}

function cellValue(
  cell: ClassSheetCell | undefined,
  period: ResultScope,
  numeric: boolean,
): string {
  if (!cell) return "";
  if (numeric) {
    const score = period === "MIDTERM" ? cell.quizScore : cell.examScore;
    return score != null ? String(score) : "";
  }
  return (period === "MIDTERM" ? cell.midtermRatingOptionId : cell.ratingOptionId) ?? "";
}

function draftsFromSheet(
  sheet: ClassAssessmentSheetView,
  period: ResultScope,
): Record<string, string> {
  const numeric = sheet.assessmentMode === "NUMERIC";
  const drafts: Record<string, string> = {};
  for (const cell of sheet.cells) {
    drafts[cellKey(cell.enrollmentId, cell.subjectId)] = cellValue(cell, period, numeric);
  }
  return drafts;
}

function parseScore(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function scoreError(value: string, max: number): string | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "Enter a number.";
  if (parsed < 0 || parsed > max) return `0 to ${max}.`;
  return null;
}

/** Whether a subject is assessed in this period at all - one that isn't gets no row. */
function assessedIn(subject: SheetSubject, period: ResultScope): boolean {
  return period === "MIDTERM"
    ? subject.assessmentPeriods !== "EXAM_ONLY"
    : subject.assessmentPeriods !== "MIDTERM_ONLY";
}

/** Why a cell can't be recorded, or `null` when it can. */
function lockedReason(cell: ClassSheetCell | undefined): string | null {
  if (cell && !cell.offered) return "Doesn't offer this subject";
  return null;
}

/** The grid's rows in display order: a group heading before its subjects, ungrouped subjects trailing. */
type DisplayRow =
  { kind: "group"; label: string } | { kind: "subject"; subject: SheetSubject; index: number };

function displayRows(subjects: SheetSubject[]): DisplayRow[] {
  const { sections, ungrouped } = groupSubjects(
    subjects.map((subject) => ({
      subjectId: subject.subjectId,
      subjectName: subject.name,
      subjectGroupId: subject.subjectGroupId,
      subjectGroupName: subject.subjectGroupName,
      subject,
    })),
  );
  const rows: DisplayRow[] = [];
  let index = 0;
  const pushSubjects = (list: typeof ungrouped) => {
    for (const entry of list)
      rows.push({ kind: "subject", subject: entry.subject, index: index++ });
  };
  for (const section of sections) {
    rows.push({ kind: "group", label: section.label });
    pushSubjects(section.subjects);
  }
  if (sections.length > 0 && ungrouped.length > 0)
    rows.push({ kind: "group", label: "Other subjects" });
  pushSubjects(ungrouped);
  return rows;
}

interface AllSubjectsEntryGridProps {
  sheet: ClassAssessmentSheetView;
  onSaved: (outcomes: CellOutcome[]) => void;
}

/**
 * The class teacher's all-subjects sheet - `RatingEntryGrid`/`ScoreEntryGrid` transposed: subjects
 * down the left (under their subject groups when the class has any, "Other subjects" trailing),
 * students across the top. One period at a time via the Mid-term / End of term toggle - a cell is
 * the period's rating (QUALITATIVE) or its quiz/exam mark (NUMERIC), never an observation, and a
 * save never touches the other period. A subject not assessed in the selected period (EXAM_ONLY at
 * mid-term, MIDTERM_ONLY at end of term) is hidden outright rather than shown locked. Same shell as the single-subject grids: dirty cells batch
 * into the sticky save bar, and leaving (or switching period) with unsaved cells asks first. From
 * `md` up the sheet scrolls inside a viewport-high box so the student-name row stays pinned.
 * Below `md` the shared Table collapses each subject into a card listing its students.
 */
export function AllSubjectsEntryGrid({ sheet, onSaved }: AllSubjectsEntryGridProps) {
  const [period, setPeriod] = useState<ResultScope>("MIDTERM");
  const [pendingPeriod, setPendingPeriod] = useState<ResultScope | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    draftsFromSheet(sheet, period),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new sheet (post-save reload, or a different class/term) is adopted during render - see
  // ScoreEntryGrid's identical comment for why this isn't an effect.
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setDrafts(draftsFromSheet(sheet, period));
    setDirty(new Set());
  }

  const blocker = useBlocker(dirty.size > 0);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (dirty.size > 0) {
        event.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const numeric = sheet.assessmentMode === "NUMERIC";
  const max = (period === "MIDTERM" ? sheet.quizMax : sheet.examMax) ?? 100;
  const periodSubjects = useMemo(
    () => sheet.subjects.filter((subject) => assessedIn(subject, period)),
    [sheet.subjects, period],
  );
  const rows = useMemo(() => displayRows(periodSubjects), [periodSubjects]);
  const cellsByKey = useMemo(() => {
    const map = new Map<string, ClassSheetCell>();
    for (const cell of sheet.cells) map.set(cellKey(cell.enrollmentId, cell.subjectId), cell);
    return map;
  }, [sheet.cells]);

  function switchPeriod(next: ResultScope) {
    setPeriod(next);
    setDrafts(draftsFromSheet(sheet, next));
    setDirty(new Set());
    setError(null);
  }

  function requestPeriod(next: ResultScope) {
    if (next === period) return;
    if (dirty.size > 0) setPendingPeriod(next);
    else switchPeriod(next);
  }

  function updateCell(key: string, value: string) {
    setDrafts((current) => ({ ...current, [key]: value }));
    setDirty((current) => new Set(current).add(key));
  }

  function discard() {
    setDrafts(draftsFromSheet(sheet, period));
    setDirty(new Set());
  }

  function focusCell(rowIndex: number, columnIndex: number) {
    document.getElementById(`all-subjects-${rowIndex}-${columnIndex}`)?.focus();
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    columnIndex: number,
  ) {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(rowIndex + 1, columnIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(rowIndex - 1, columnIndex);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const keys = Array.from(dirty).map((key) => {
        const [enrollmentId, subjectId] = key.split(":");
        return { key, enrollmentId, subjectId };
      });
      const outcome = numeric
        ? await saveClassScores(
            sheet.classId,
            sheet.termId,
            period,
            keys.map(({ key, enrollmentId, subjectId }) => ({
              enrollmentId,
              subjectId,
              score: parseScore(drafts[key] ?? ""),
            })),
          )
        : await saveClassRatings(
            sheet.classId,
            sheet.termId,
            period,
            keys.map(({ key, enrollmentId, subjectId }) => ({
              enrollmentId,
              subjectId,
              ratingOptionId: drafts[key] || null,
            })),
          );
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : numeric
            ? "Failed to save scores"
            : "Failed to save ratings",
      );
    } finally {
      setSaving(false);
    }
  }

  const columnCount = sheet.students.length + 1;
  const periodLabel = period === "MIDTERM" ? "Mid-term" : "End of term";

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ScopeToggle scope={period} onChange={requestPeriod} />
        <p className="text-sm text-slate-500">
          {numeric
            ? `${period === "MIDTERM" ? "Mid-term quiz" : "Exam"} marks, out of ${max}.`
            : `${periodLabel} ratings. Add observations from a single subject.`}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {periodSubjects.length === 0 || sheet.students.length === 0 ? (
        <p className="text-sm text-slate-500">
          {sheet.subjects.length === 0
            ? "No graded subjects are taught this term."
            : periodSubjects.length === 0
              ? `No graded subjects are assessed at ${periodLabel.toLowerCase()}.`
              : "No students are enrolled in this class."}
        </p>
      ) : (
        <Table containerClassName="md:max-h-[75vh] md:overflow-y-auto">
          <TableHead>
            <TableRow>
              <TableHeaderCell
                className={`left-0 z-30 min-w-[12rem] ${STICKY_HEADER_CELL}`}
              >
                Subject
              </TableHeaderCell>
              {sheet.students.map((student) => (
                <TableHeaderCell
                  key={student.enrollmentId}
                  className={`z-20 min-w-[10rem] normal-case tracking-normal ${STICKY_HEADER_CELL}`}
                >
                  <span className="block text-sm font-medium text-slate-900">
                    {student.studentName}
                  </span>
                  <span className="block text-xs font-normal text-slate-500">
                    {student.admissionNumber}
                  </span>
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) =>
              row.kind === "group" ? (
                <TableRow key={`group-${row.label}`} className="bg-slate-50 hover:bg-slate-50">
                  <TableCell
                    colSpan={columnCount}
                    className="text-xs font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {row.label}
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={row.subject.subjectId}>
                  <TableCell className="sticky left-0 z-10 bg-white">
                    <span className="mr-2 tabular-nums text-slate-400">{row.index + 1}.</span>
                    <span className="font-medium text-slate-900">{row.subject.name}</span>
                  </TableCell>
                  {sheet.students.map((student, columnIndex) => {
                    const key = cellKey(student.enrollmentId, row.subject.subjectId);
                    const locked = lockedReason(cellsByKey.get(key));
                    const isDirty = dirty.has(key);
                    const value = drafts[key] ?? "";
                    const label = `${periodLabel} ${numeric ? "mark" : "rating"} for ${student.studentName} in ${row.subject.name}`;

                    if (locked) {
                      return (
                        <TableCell
                          key={key}
                          label={student.studentName}
                          title={locked}
                          className="text-slate-400"
                        >
                          <span
                            aria-label={`${student.studentName}, ${row.subject.name}: ${locked}`}
                          >
                            —
                          </span>
                        </TableCell>
                      );
                    }
                    if (numeric) {
                      const invalid = scoreError(value, max);
                      return (
                        <TableCell key={key} label={student.studentName} numeric>
                          <Input
                            id={`all-subjects-${row.index}-${columnIndex}`}
                            type="number"
                            inputMode="decimal"
                            enterKeyHint="next"
                            step="any"
                            aria-label={label}
                            className={`text-right tabular-nums ${isDirty ? "border-brand-400" : ""}`}
                            value={value}
                            aria-invalid={invalid ? "true" : undefined}
                            onChange={(event) => updateCell(key, event.target.value)}
                            onKeyDown={(event) => handleKeyDown(event, row.index, columnIndex)}
                          />
                          {invalid && <p className="mt-1 text-xs text-red-600">{invalid}</p>}
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={key} label={student.studentName}>
                        <Select
                          aria-label={label}
                          className={isDirty ? "border-brand-400" : ""}
                          value={value}
                          onChange={(event) => updateCell(key, event.target.value)}
                        >
                          <option value="">—</option>
                          {sheet.ratingOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      )}

      <UnsavedChangesBar
        count={dirty.size}
        saving={saving}
        onSave={handleSave}
        onDiscard={discard}
      />

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved changes on this sheet that will be lost."
          confirmLabel="Leave"
          variant="danger"
          onConfirm={async () => {
            blocker.proceed();
          }}
          onClose={() => blocker.reset()}
        />
      )}

      {pendingPeriod && (
        <ConfirmDialog
          title="Switch period without saving?"
          message={`You have unsaved ${periodLabel.toLowerCase()} changes that will be lost.`}
          confirmLabel="Switch"
          variant="danger"
          onConfirm={async () => {
            switchPeriod(pendingPeriod);
            setPendingPeriod(null);
          }}
          onClose={() => setPendingPeriod(null)}
        />
      )}
    </div>
  );
}
