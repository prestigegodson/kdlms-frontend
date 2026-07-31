import { type KeyboardEvent, useEffect, useState } from "react";
import { useBlocker } from "react-router";
import { type AssessmentSheetView, type RowOutcome, saveScores } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { computeFinalScore } from "@/features/assessments/finalScore";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

interface Draft {
  quiz: string;
  exam: string;
}

function draftsFromSheet(sheet: AssessmentSheetView): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const row of sheet.rows) {
    drafts[row.enrollmentId] = {
      quiz: row.quizScore != null ? String(row.quizScore) : "",
      exam: row.examScore != null ? String(row.examScore) : "",
    };
  }
  return drafts;
}

function parseScore(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function rowError(value: string, max: number): string | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return "Enter a number.";
  if (parsed < 0 || parsed > max) return `Must be between 0 and ${max}.`;
  return null;
}

interface ScoreEntryGridProps {
  sheet: AssessmentSheetView;
  onSaved: (outcomes: RowOutcome[]) => void;
}

/**
 * The score entry grid - the one place this phase spends design attention.
 * As a teacher types a quiz/exam mark, the final score and grade resolve
 * live in a trailing read-only column, before anything is saved. Edits
 * batch into a sticky "Save changes" bar rather than autosaving per cell,
 * and Enter/arrow keys move focus down the same column - the highest-volume
 * typing task in the product.
 */
export function ScoreEntryGrid({ sheet, onSaved }: ScoreEntryGridProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsFromSheet(sheet));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new sheet (different class/subject/term, or a post-save reload) is adopted by comparing
  // against the last-seen sheet during render - the "adjust state while rendering" case React's
  // docs call out, same technique SearchInput's external-reset handling uses - rather than an effect.
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setDrafts(draftsFromSheet(sheet));
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

  const quizMax = sheet.quizMax ?? 100;
  const examMax = sheet.examMax ?? 100;
  const quizWeight = sheet.quizWeight ?? 0;
  const examWeight = sheet.examWeight ?? 0;

  function updateCell(enrollmentId: string, field: "quiz" | "exam", value: string) {
    setDrafts((current) => ({ ...current, [enrollmentId]: { ...current[enrollmentId], [field]: value } }));
    setDirty((current) => new Set(current).add(enrollmentId));
  }

  function discard() {
    setDrafts(draftsFromSheet(sheet));
    setDirty(new Set());
  }

  function focusCell(rowIndex: number, field: "quiz" | "exam") {
    document.getElementById(`score-${rowIndex}-${field}`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, field: "quiz" | "exam") {
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(rowIndex + 1, field);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(rowIndex - 1, field);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const entries = Array.from(dirty).map((enrollmentId) => ({
        enrollmentId,
        quizScore: parseScore(drafts[enrollmentId]?.quiz ?? ""),
        examScore: parseScore(drafts[enrollmentId]?.exam ?? ""),
      }));
      const outcome = await saveScores(sheet.classId, sheet.subjectId, sheet.termId, entries);
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save scores");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}
      {!sheet.quizEnabled && (
        <Alert variant="info">Quiz scoring isn't included in this school's plan - record exam scores only.</Alert>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell numeric>Quiz (/{quizMax})</TableHeaderCell>
            <TableHeaderCell numeric>Exam (/{examMax})</TableHeaderCell>
            <TableHeaderCell numeric>Final</TableHeaderCell>
            <TableHeaderCell>Grade</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sheet.rows.map((row, index) => {
            const draft = drafts[row.enrollmentId] ?? { quiz: "", exam: "" };
            const isDirty = dirty.has(row.enrollmentId);
            const quizError = sheet.quizEnabled ? rowError(draft.quiz, quizMax) : null;
            const examError = rowError(draft.exam, examMax);
            const computed = computeFinalScore(
              parseScore(draft.quiz),
              parseScore(draft.exam),
              quizMax,
              examMax,
              quizWeight,
              examWeight,
              sheet.boundaries,
            );

            return (
              <TableRow key={row.enrollmentId} className={isDirty ? "border-l-2 border-l-brand-500" : ""}>
                <TableCell label="Student">
                  <span className="font-medium text-slate-900">{row.studentName}</span>
                  <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
                </TableCell>
                <TableCell label={`Quiz (/${quizMax})`} numeric>
                  <Input
                    id={`score-${index}-quiz`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`Quiz score for ${row.studentName}`}
                    className={`text-right tabular-nums ${isDirty ? "border-brand-400" : ""}`}
                    disabled={!sheet.quizEnabled}
                    value={draft.quiz}
                    aria-invalid={quizError ? "true" : undefined}
                    onChange={(event) => updateCell(row.enrollmentId, "quiz", event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, index, "quiz")}
                  />
                  {quizError && <p className="mt-1 text-xs text-red-600">{quizError}</p>}
                </TableCell>
                <TableCell label={`Exam (/${examMax})`} numeric>
                  <Input
                    id={`score-${index}-exam`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-label={`Exam score for ${row.studentName}`}
                    className={`text-right tabular-nums ${isDirty ? "border-brand-400" : ""}`}
                    value={draft.exam}
                    aria-invalid={examError ? "true" : undefined}
                    onChange={(event) => updateCell(row.enrollmentId, "exam", event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, index, "exam")}
                  />
                  {examError && <p className="mt-1 text-xs text-red-600">{examError}</p>}
                </TableCell>
                <TableCell label="Final" numeric className="tabular-nums text-slate-700">
                  {computed.finalScore ?? "—"}
                </TableCell>
                <TableCell label="Grade">
                  {computed.grade ? <Badge variant="brand">{computed.grade}</Badge> : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <UnsavedChangesBar count={dirty.size} saving={saving} onSave={handleSave} onDiscard={discard} />

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved score changes on this sheet that will be lost."
          confirmLabel="Leave"
          variant="danger"
          onConfirm={async () => {
            blocker.proceed();
          }}
          onClose={() => blocker.reset()}
        />
      )}
    </div>
  );
}
