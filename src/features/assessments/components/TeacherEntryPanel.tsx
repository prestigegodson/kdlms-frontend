import { useEffect, useState } from "react";
import { type AssessmentSheetView, openSheet, type RowOutcome } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listMyClasses, listRecordableSubjects, type TeacherClassView } from "@/api/me";
import type { SubjectView } from "@/api/subjects";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { RatingEntryGrid } from "@/features/assessments/components/RatingEntryGrid";
import { SaveOutcomeList } from "@/features/assessments/components/SaveOutcomeList";
import { ScoreEntryGrid } from "@/features/assessments/components/ScoreEntryGrid";
import { ClipboardCheck } from "lucide-react";

interface TeacherEntryPanelProps {
  /** Seeds the initial class selection (e.g. from ClassDetailPage's "Results & broadsheet" quick link). */
  initialClassId?: string;
}

/** A TEACHER's recording flow: pick a class, subject, and term, then fill in the sheet. */
export function TeacherEntryPanel({ initialClassId }: TeacherEntryPanelProps = {}) {
  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [subjects, setSubjects] = useState<SubjectView[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");

  const [sheet, setSheet] = useState<AssessmentSheetView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  // Class/subject/term selection resets downstream state during render (see ScoreEntryGrid's
  // comment on this pattern) rather than in an effect; the effects below only fetch.
  const [lastClassId, setLastClassId] = useState(classId);
  if (classId !== lastClassId) {
    setLastClassId(classId);
    setSubjectId("");
    setSubjects(null);
  }

  const sheetKey = `${classId}|${subjectId}|${termId}`;
  const [lastSheetKey, setLastSheetKey] = useState(sheetKey);
  if (sheetKey !== lastSheetKey) {
    setLastSheetKey(sheetKey);
    setSheet(null);
    setOutcomes(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId) return;
    listRecordableSubjects(classId)
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, [classId]);

  useEffect(() => {
    if (!classId || !subjectId || !termId) return;
    openSheet(classId, subjectId, termId)
      .then(setSheet)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load the sheet"));
  }, [classId, subjectId, termId]);

  function reload() {
    if (!classId || !subjectId || !termId) return;
    openSheet(classId, subjectId, termId).then(setSheet).catch(() => undefined);
  }

  function handleSaved(rowOutcomes: RowOutcome[]) {
    setOutcomes(rowOutcomes);
    reload();
  }

  const classOptions = (classes ?? []).map((c) => ({ id: c.classId, name: c.className }));

  return (
    <div className="space-y-6">
      <PageHeader title="Record scores" description="Pick a class, subject, and term to open its sheet." />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your classes…
        </div>
      )}
      {classes !== null && classes.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title="No classes assigned yet"
          description="You'll see this page once you're assigned as a class or subject teacher."
        />
      )}

      {classes !== null && classes.length > 0 && (
        <StickySubHeader>
          <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId}>
            {classId && (
              <FormField label="Subject" htmlFor="entry-subject" labelClassName="sr-only lg:not-sr-only">
                <Select id="entry-subject" value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                  <option value="">Select a subject…</option>
                  {(subjects ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
          </ClassTermPicker>
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {sheet && sheet.assessmentMode === "NUMERIC" && <ScoreEntryGrid sheet={sheet} onSaved={handleSaved} />}
      {sheet && sheet.assessmentMode === "QUALITATIVE" && <RatingEntryGrid sheet={sheet} onSaved={handleSaved} />}

      {outcomes && <SaveOutcomeList outcomes={outcomes} nameOf={(id) => sheet?.rows.find((row) => row.enrollmentId === id)?.studentName ?? id} />}
    </div>
  );
}
