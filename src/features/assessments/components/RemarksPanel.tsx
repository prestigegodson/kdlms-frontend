import { useEffect, useState } from "react";
import { getRemarksSheet, type RemarksSheetView, type RowOutcome } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { RemarksEntryGrid } from "@/features/assessments/components/RemarksEntryGrid";
import { SaveOutcomeList } from "@/features/assessments/components/SaveOutcomeList";
import { NotebookPen } from "lucide-react";

interface RemarksPanelProps {
  /** Seeds the initial class selection (e.g. from ClassDetailPage's "Results & broadsheet" quick link). */
  initialClassId?: string;
}

/**
 * A TEACHER's termly-remarks flow - pick a class and term, then fill in the
 * roster's remarks. Mirrors `TeacherEntryPanel`'s shape, minus the Subject
 * field (a remark is per student per term, not per subject). Read access is
 * broader than write: any of the caller's classes (class-teach ∪
 * subject-teach, via `listMyClasses`) shows a sheet, but only a class
 * teacher's own class comes back with `classTeacherEditable: true` -
 * `RemarksEntryGrid` renders read-only text for everyone else.
 */
export function RemarksPanel({ initialClassId }: RemarksPanelProps = {}) {
  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [termId, setTermId] = useState("");

  const [sheet, setSheet] = useState<RemarksSheetView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  // Selection resets downstream state during render (see ScoreEntryGrid's comment on this
  // pattern) rather than in an effect; the effect below only fetches.
  const sheetKey = `${classId}|${termId}`;
  const [lastSheetKey, setLastSheetKey] = useState(sheetKey);
  if (sheetKey !== lastSheetKey) {
    setLastSheetKey(sheetKey);
    setSheet(null);
    setOutcomes(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getRemarksSheet(classId, termId)
      .then(setSheet)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load the remarks sheet"));
  }, [classId, termId]);

  function reload() {
    if (!classId || !termId) return;
    getRemarksSheet(classId, termId).then(setSheet).catch(() => undefined);
  }

  function handleSaved(rowOutcomes: RowOutcome[]) {
    setOutcomes(rowOutcomes);
    reload();
  }

  const classOptions = (classes ?? []).map((c) => ({ id: c.classId, name: c.className }));

  return (
    <div className="space-y-6">
      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your classes…
        </div>
      )}
      {classes !== null && classes.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="No classes assigned yet"
          description="You'll see this once you're assigned as a class or subject teacher."
        />
      )}

      {classes !== null && classes.length > 0 && (
        <StickySubHeader collapsible>
          <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId} />
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {sheet && !sheet.classTeacherEditable && (
        <Alert variant="warning">
          Only this class's class teacher can write remarks or behavioural-trait ratings - you can still see what's been written.
        </Alert>
      )}

      {sheet && <RemarksEntryGrid sheet={sheet} field="classTeacher" onSaved={handleSaved} />}

      {outcomes && (
        <SaveOutcomeList outcomes={outcomes} nameOf={(id) => sheet?.rows.find((row) => row.enrollmentId === id)?.studentName ?? id} />
      )}
    </div>
  );
}
