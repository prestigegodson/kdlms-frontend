import { useEffect, useState } from "react";
import {
  type AssessmentSheetView,
  type CellOutcome,
  type ClassAssessmentSheetView,
  openClassSheet,
  openSheet,
  type RowOutcome,
} from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listClasses } from "@/api/classes";
import { listMyClasses, listRecordableSubjects, type TeacherClassView } from "@/api/me";
import type { SubjectView } from "@/api/subjects";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader, useFilterChip } from "@/components/ui/StickySubHeader";
import { SubjectTargetSelect } from "@/features/academics/components/SubjectTargetSelect";
import { AllSubjectsEntryGrid } from "@/features/assessments/components/AllSubjectsEntryGrid";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { RatingEntryGrid } from "@/features/assessments/components/RatingEntryGrid";
import { SaveOutcomeList } from "@/features/assessments/components/SaveOutcomeList";
import { ScoreEntryGrid } from "@/features/assessments/components/ScoreEntryGrid";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";
import { ClipboardCheck } from "lucide-react";

/** The Subject picker's "All subjects" key - never a subject id (a UUID) or a `group:` key. */
export const ALL_SUBJECTS_KEY = "all";

interface TeacherEntryPanelProps {
  /** Seeds the initial class selection (e.g. from ClassDetailPage's "Results & broadsheet" quick link). */
  initialClassId?: string;
  /** Seeds the initial subject selection (e.g. from SubjectsPage's "Record assessment" row action). */
  initialSubjectId?: string;
  /**
   * A Head of Level's "My levels" view: the picker lists every class at the levels they head
   * (not the classes they teach), each recordable like its class teacher's - see
   * AssessmentAccessGuard.isHeadOf server-side.
   */
  levelClasses?: boolean;
}

/**
 * A TEACHER's recording flow: pick a class, subject, and term, then fill in
 * the sheet. Renders as the "Scores" tab body under `AssessmentsPage`'s own
 * PageHeader, so it carries no title of its own. A class/assistant teacher
 * also gets an "All subjects" choice for their own classes, which opens the
 * transposed all-subjects sheet (`AllSubjectsEntryGrid`) instead. With
 * `levelClasses`, a Head of Level records for their headed levels' classes.
 */
export function TeacherEntryPanel({ initialClassId, initialSubjectId, levelClasses = false }: TeacherEntryPanelProps = {}) {
  const headOfLevelIds = useTeacherScopeStore((state) => state.capabilities?.headOfLevelIds);
  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [subjects, setSubjects] = useState<SubjectView[] | null>(null);
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [termId, setTermId] = useState("");

  const [sheet, setSheet] = useState<AssessmentSheetView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);
  const [classSheet, setClassSheet] = useState<ClassAssessmentSheetView | null>(null);
  const [cellOutcomes, setCellOutcomes] = useState<CellOutcome[] | null>(null);

  useEffect(() => {
    if (!levelClasses) {
      listMyClasses()
        .then(setClasses)
        .catch(() => setClasses([]));
      return;
    }
    if (!headOfLevelIds) return;
    // The server's class list for a head is their levels' classes plus any class they teach
    // elsewhere - narrow to the headed levels, each one recordable like its class teacher's.
    listClasses(undefined, undefined, 0, 200)
      .then((page) =>
        setClasses(
          page.content
            .filter((c) => headOfLevelIds.includes(c.levelId))
            .map((c) => ({
              classId: c.id,
              branchId: c.branchId,
              levelId: c.levelId,
              className: c.name,
              isClassTeacher: true,
              isAssistantTeacher: false,
              subjectIds: [],
            })),
        ),
      )
      .catch(() => setClasses([]));
  }, [levelClasses, headOfLevelIds]);

  const allSubjects = subjectId === ALL_SUBJECTS_KEY;
  // `isClassTeacher` already covers an assistant (see TeacherClassView) - a subject teacher never gets "All subjects".
  const canPickAllSubjects = (classes ?? []).some((c) => c.classId === classId && c.isClassTeacher);

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
    setClassSheet(null);
    setCellOutcomes(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId) return;
    // A non-graded subject (e.g. Assembly) has no entry sheet, so it never
    // reaches the picker - the backend refuses to open one anyway.
    listRecordableSubjects(classId)
      .then((recordable) => setSubjects(recordable.filter((subject) => subject.graded)))
      .catch(() => setSubjects([]));
  }, [classId]);

  useEffect(() => {
    if (!classId || !subjectId || !termId) return;
    const onError = (error: unknown) =>
      setLoadError(error instanceof ApiError ? error.message : "Failed to load the sheet");
    if (subjectId === ALL_SUBJECTS_KEY) {
      openClassSheet(classId, termId).then(setClassSheet).catch(onError);
      return;
    }
    openSheet(classId, subjectId, termId).then(setSheet).catch(onError);
  }, [classId, subjectId, termId]);

  function reload() {
    if (!classId || !subjectId || !termId) return;
    if (subjectId === ALL_SUBJECTS_KEY) {
      openClassSheet(classId, termId).then(setClassSheet).catch(() => undefined);
      return;
    }
    openSheet(classId, subjectId, termId).then(setSheet).catch(() => undefined);
  }

  function handleSaved(rowOutcomes: RowOutcome[]) {
    setOutcomes(rowOutcomes);
    reload();
  }

  function handleCellsSaved(saved: CellOutcome[]) {
    setCellOutcomes(saved);
    reload();
  }

  function cellName(outcome: CellOutcome): string {
    const student = classSheet?.students.find((s) => s.enrollmentId === outcome.enrollmentId)?.studentName;
    const subject = classSheet?.subjects.find((s) => s.subjectId === outcome.subjectId)?.name;
    return `${student ?? outcome.enrollmentId} – ${subject ?? outcome.subjectId}`;
  }

  const failedCells = (cellOutcomes ?? []).filter((outcome) => !outcome.success);

  const classOptions = (classes ?? []).map((c) => ({ id: c.classId, name: c.className }));

  // Published unconditionally (mirrors BranchFilter's hook-before-early-return note) even though
  // the Subject field itself only renders once a class is chosen - a no-op chip until then.
  useFilterChip(
    "subject",
    classId ? (allSubjects ? "All subjects" : (subjects ?? []).find((subject) => subject.id === subjectId)?.name) : null,
  );

  return (
    <div className="space-y-6">
      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> {levelClasses ? "Loading classes…" : "Loading your classrooms…"}
        </div>
      )}
      {classes !== null && classes.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={levelClasses ? "No classes at your levels yet" : "No classrooms assigned yet"}
          description={
            levelClasses
              ? "Classes at the levels you head will appear here."
              : "You'll see this page once you're assigned as a class or subject teacher."
          }
        />
      )}

      {classes !== null && classes.length > 0 && (
        <StickySubHeader collapsible>
          <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId}>
            {classId && (
              <FormField label="Subject" htmlFor="entry-subject">
                <SubjectTargetSelect
                  id="entry-subject"
                  value={subjectId}
                  onChange={setSubjectId}
                  leadingOptions={canPickAllSubjects ? [{ key: ALL_SUBJECTS_KEY, label: "All subjects" }] : undefined}
                  subjects={(subjects ?? []).map((subject) => ({
                    subjectId: subject.id,
                    subjectName: subject.name,
                    subjectGroupId: subject.subjectGroupId,
                    subjectGroupName: subject.subjectGroupName,
                  }))}
                />
              </FormField>
            )}
          </ClassTermPicker>
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {sheet && sheet.assessmentMode === "NUMERIC" && <ScoreEntryGrid sheet={sheet} onSaved={handleSaved} />}
      {sheet && sheet.assessmentMode === "QUALITATIVE" && <RatingEntryGrid sheet={sheet} onSaved={handleSaved} />}

      {classSheet && <AllSubjectsEntryGrid sheet={classSheet} onSaved={handleCellsSaved} />}

      {cellOutcomes && (
        <SaveOutcomeList
          outcomes={cellOutcomes.map((outcome) => ({ ...outcome, enrollmentId: `${outcome.enrollmentId}:${outcome.subjectId}` }))}
          nameOf={(key) => key}
        />
      )}
      {failedCells.length > 0 && (
        <Alert variant="warning" title="Some cells weren't saved">
          <ul className="list-disc space-y-1 pl-5">
            {failedCells.map((outcome) => (
              <li key={`${outcome.enrollmentId}:${outcome.subjectId}`}>
                {cellName(outcome)}: {outcome.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {outcomes && <SaveOutcomeList outcomes={outcomes} nameOf={(id) => sheet?.rows.find((row) => row.enrollmentId === id)?.studentName ?? id} />}
    </div>
  );
}
