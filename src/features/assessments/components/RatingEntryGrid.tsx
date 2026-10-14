import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import { type AssessmentSheetView, type RowOutcome, saveRatings } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

interface Draft {
  midtermRatingOptionId: string;
  midtermObservation: string;
  ratingOptionId: string;
  observation: string;
}

function draftsFromSheet(sheet: AssessmentSheetView): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const row of sheet.rows) {
    drafts[row.enrollmentId] = {
      midtermRatingOptionId: row.midtermRatingOptionId ?? "",
      midtermObservation: row.midtermObservation ?? "",
      ratingOptionId: row.ratingOptionId ?? "",
      observation: row.observation ?? "",
    };
  }
  return drafts;
}

interface RatingEntryGridProps {
  sheet: AssessmentSheetView;
  onSaved: (outcomes: RowOutcome[]) => void;
}

/**
 * The rating entry grid - a scale Select plus an optional observation per
 * student, for both the mid-term and end-of-term checkpoints (independent
 * pairs, either of which may be recorded before the other - see
 * CLAUDE.md's ResultScope domain rule). No scores anywhere. Shares
 * ScoreEntryGrid's shell: same dirty rule, same sticky save bar, same
 * navigate-away guard. A midterm-only or exam-only subject shows (and sends)
 * only its own pair.
 */
export function RatingEntryGrid({ sheet, onSaved }: RatingEntryGridProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => draftsFromSheet(sheet));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new sheet is adopted by comparing against the last-seen sheet during render -
  // see ScoreEntryGrid's identical comment for why this isn't an effect.
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

  function updateCell(enrollmentId: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [enrollmentId]: { ...current[enrollmentId], [field]: value } }));
    setDirty((current) => new Set(current).add(enrollmentId));
  }

  function discard() {
    setDrafts(draftsFromSheet(sheet));
    setDirty(new Set());
  }

  const showMidterm = sheet.assessmentPeriods !== "EXAM_ONLY";
  const showExam = sheet.assessmentPeriods !== "MIDTERM_ONLY";

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const entries = Array.from(dirty)
        .filter(
          (enrollmentId) =>
            (showMidterm && drafts[enrollmentId]?.midtermRatingOptionId) ||
            (showExam && drafts[enrollmentId]?.ratingOptionId),
        )
        .map((enrollmentId) => ({
          enrollmentId,
          midtermRatingOptionId: showMidterm ? drafts[enrollmentId].midtermRatingOptionId || null : null,
          midtermObservation:
            !showMidterm || drafts[enrollmentId].midtermObservation.trim() === "" ? null : drafts[enrollmentId].midtermObservation,
          ratingOptionId: showExam ? drafts[enrollmentId].ratingOptionId || null : null,
          observation: !showExam || drafts[enrollmentId].observation.trim() === "" ? null : drafts[enrollmentId].observation,
        }));
      const outcome = await saveRatings(sheet.classId, sheet.subjectId, sheet.termId, entries);
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save ratings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Pupil</TableHeaderCell>
            {showMidterm && <TableHeaderCell>Midterm rating</TableHeaderCell>}
            {showMidterm && <TableHeaderCell>Midterm observation</TableHeaderCell>}
            {showExam && <TableHeaderCell>End-of-term rating</TableHeaderCell>}
            {showExam && <TableHeaderCell>End-of-term observation</TableHeaderCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sheet.rows.map((row) => {
            const draft = drafts[row.enrollmentId] ?? {
              midtermRatingOptionId: "",
              midtermObservation: "",
              ratingOptionId: "",
              observation: "",
            };
            const isDirty = dirty.has(row.enrollmentId);

            return (
              <TableRow key={row.enrollmentId} className={isDirty ? "border-l-2 border-l-brand-500" : ""}>
                <TableCell label="Pupil">
                  <span className="font-medium text-slate-900">{row.studentName}</span>
                  <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
                </TableCell>
                {showMidterm && (
                  <TableCell label="Midterm rating">
                    <Select
                      aria-label={`Midterm rating for ${row.studentName}`}
                      className={isDirty ? "border-brand-400" : ""}
                      value={draft.midtermRatingOptionId}
                      onChange={(event) => updateCell(row.enrollmentId, "midtermRatingOptionId", event.target.value)}
                    >
                      <option value="">Select a rating…</option>
                      {sheet.ratingOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                )}
                {showMidterm && (
                  <TableCell label="Midterm observation">
                    <Textarea
                      aria-label={`Midterm observation for ${row.studentName}`}
                      rows={2}
                      className={isDirty ? "border-brand-400" : ""}
                      value={draft.midtermObservation}
                      onChange={(event) => updateCell(row.enrollmentId, "midtermObservation", event.target.value)}
                    />
                  </TableCell>
                )}
                {showExam && (
                  <TableCell label="End-of-term rating">
                    <Select
                      aria-label={`End-of-term rating for ${row.studentName}`}
                      className={isDirty ? "border-brand-400" : ""}
                      value={draft.ratingOptionId}
                      onChange={(event) => updateCell(row.enrollmentId, "ratingOptionId", event.target.value)}
                    >
                      <option value="">Select a rating…</option>
                      {sheet.ratingOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                )}
                {showExam && (
                  <TableCell label="End-of-term observation">
                    <Textarea
                      aria-label={`End-of-term observation for ${row.studentName}`}
                      rows={2}
                      className={isDirty ? "border-brand-400" : ""}
                      value={draft.observation}
                      onChange={(event) => updateCell(row.enrollmentId, "observation", event.target.value)}
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <UnsavedChangesBar count={dirty.size} saving={saving} onSave={handleSave} onDiscard={discard} />

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved rating changes on this sheet that will be lost."
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
