import { useEffect, useState } from "react";
import { getClass, listClasses, type SchoolClassView } from "@/api/classes";
import { ApiError } from "@/api/client";
import { listSubjects, type SubjectView } from "@/api/subjects";
import { type ClassTimetableView, getClassTimetable, type TimetableRowOutcome } from "@/api/timetable";
import { listTeachers } from "@/api/users";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { TimetableGrid, TimetableOutcomeList } from "@/components/TimetableGrid";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { CopyTermModal } from "@/features/timetable/components/CopyTermModal";
import { useAuthStore } from "@/stores/authStore";
import { CalendarDays } from "lucide-react";

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface AdminTimetablePanelProps {
  /** Seeds the class selection (e.g. from a class detail page's quick link). */
  initialClassId?: string;
}

/**
 * SCHOOL_ADMIN/BRANCH_ADMIN's class-timetable authoring screen -
 * `PageHeader` -> `StickySubHeader` (`collapsible`, since Branch/Session/
 * Term/Class is a required-selector row of three-plus fields, the
 * `AdminResultsPanel` precedent) -> `TimetableGrid`. No teacher write path
 * exists (unlike attendance) - see CLAUDE.md's Roles table.
 */
export function AdminTimetablePanel({ initialClassId }: AdminTimetablePanelProps = {}) {
  const role = useAuthStore((state) => state.user?.role);
  const showsBranchFilter = can.selectBranch(role);
  const { ready: branchReady, branchId } = useBranchScope();

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [termId, setTermId] = useState("");
  const [view, setView] = useState<ClassTimetableView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectView[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [outcomes, setOutcomes] = useState<TimetableRowOutcome[] | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, [branchReady, branchId]);

  // A branch change resets the class list to null during render (see ScoreEntryGrid's
  // comment on this pattern), so the picker's own default-to-first-class logic re-applies.
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    setClasses(null);
  }

  const classOptions = (classes ?? []).map((schoolClass) => ({ id: schoolClass.id, name: schoolClass.name }));

  const selectionKey = `${classId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setView(null);
    setLoadError(null);
    setOutcomes(null);
  }

  // A class change resets its subject list during render (see ScoreEntryGrid's
  // comment on this pattern) rather than in an effect; the effect below only fetches.
  const [lastClassId, setLastClassId] = useState(classId);
  if (classId !== lastClassId) {
    setLastClassId(classId);
    setSubjects([]);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getClassTimetable(classId, termId)
      .then(setView)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the timetable"),
      );
  }, [classId, termId]);

  useEffect(() => {
    if (!classId) return;
    getClass(classId)
      .then((schoolClass) => listSubjects(schoolClass.levelId, 0, 200))
      .then((page) => setSubjects(page.content))
      .catch(() => setSubjects([]));
  }, [classId]);

  useEffect(() => {
    listTeachers(showsBranchFilter ? branchId : undefined, 0, 200)
      .then((page) =>
        setTeachers(page.content.map((teacher) => ({ id: teacher.id, name: `${teacher.firstName} ${teacher.lastName}` }))),
      )
      .catch(() => setTeachers([]));
  }, [showsBranchFilter, branchId]);

  function reload() {
    if (!classId || !termId) return;
    getClassTimetable(classId, termId).then(setView);
  }

  function periodLabelOf(dayOfWeek: number, periodId: string): string {
    const period = view?.periods.find((row) => row.periodId === periodId);
    return `${DAY_NAMES[dayOfWeek] ?? ""} · ${period?.label ?? "Period"}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description="Build a class's weekly schedule for a term."
        actions={
          classId && termId ? (
            <Button type="button" variant="secondary" onClick={() => setCopyOpen(true)}>
              Copy from another term
            </Button>
          ) : undefined
        }
      />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}

      {classes !== null && (classes.length > 0 || showsBranchFilter) && (
        <>
          <StickySubHeader collapsible>
            <BranchFilter id="timetable-branch" />
            <ClassTermPicker
              classes={classOptions}
              classId={classId}
              onClassChange={setClassId}
              termId={termId}
              onTermChange={setTermId}
            />
          </StickySubHeader>

          {loadError && <Alert variant="error">{loadError}</Alert>}
          {outcomes && <TimetableOutcomeList outcomes={outcomes} labelOf={periodLabelOf} />}

          {view && view.periods.length === 0 && (
            <EmptyState
              icon={CalendarDays}
              title="No period grid yet"
              description="A school admin must build this level's period grid (Academics -> Period grid) before a class timetable can be filled in."
            />
          )}
          {view && view.periods.length > 0 && (
            <TimetableGrid
              view={view}
              subjects={subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
              teachers={teachers}
              onSaved={(rowOutcomes) => {
                setOutcomes(rowOutcomes);
                reload();
              }}
            />
          )}
        </>
      )}

      {classId && termId && (
        <CopyTermModal
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          targetTermId={termId}
          classOptions={classOptions}
          defaultClassId={classId}
          onCopied={reload}
        />
      )}
    </div>
  );
}
