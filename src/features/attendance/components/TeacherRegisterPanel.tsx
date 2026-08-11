import { useEffect, useState } from "react";
import { type AttendanceRegisterView, getRegister, type RowOutcome } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import {
  AttendanceOutcomeList,
  AttendanceRegisterGrid,
} from "@/features/attendance/components/AttendanceRegisterGrid";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";
import { mostRecentWeekdayIso, todayIso } from "@/utils/date";
import { ClipboardList } from "lucide-react";

interface TeacherRegisterPanelProps {
  /** Seeds the initial class selection (e.g. from ClassDetailPage's "Attendance register" quick link) - just a `useState` initializer, so it never overrides an explicit later choice. */
  initialClassId?: string;
}

/**
 * A class teacher's marking flow: pick a class (class-taught only - a
 * subject-teacher-only account has nothing to mark, see CLAUDE.md) and a
 * date, then fill in the register. Defaults to today's date - or the most
 * recent weekday, if the school hasn't opted in to weekend attendance and
 * today is a Saturday/Sunday - on the first class-taught class.
 */
export function TeacherRegisterPanel({ initialClassId }: TeacherRegisterPanelProps = {}) {
  // Fetched by SchoolLayout's mount effect (same pattern as teacherScopeStore/
  // academicContextStore) - just read here.
  const allowWeekendAttendance = useSchoolSettingsStore(
    (state) => state.settings?.allowWeekendAttendance ?? false,
  );

  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [date, setDate] = useState(() => (allowWeekendAttendance ? todayIso() : mostRecentWeekdayIso()));

  const [register, setRegister] = useState<AttendanceRegisterView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);

  useEffect(() => {
    listMyClasses()
      .then((all) => setClasses(all.filter((teacherClass) => teacherClass.isClassTeacher)))
      .catch(() => setClasses([]));
  }, []);

  // No explicit selection yet once classes load -> default to the first
  // class-taught class, derived during render rather than a separate effect
  // (which would call setState synchronously on the render it fires from).
  const effectiveClassId = classId || classes?.[0]?.classId || "";

  // Selection resets downstream state during render (see ScoreEntryGrid's comment on this
  // pattern) rather than in an effect; the effect below only fetches.
  const selectionKey = `${effectiveClassId}|${date}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setRegister(null);
    setOutcomes(null);
    setLoadError(null);
  }

  function load() {
    if (!effectiveClassId || !date) return;
    getRegister(effectiveClassId, date)
      .then(setRegister)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the register"),
      );
  }

  useEffect(load, [effectiveClassId, date]);

  function handleSaved(rowOutcomes: RowOutcome[]) {
    setOutcomes(rowOutcomes);
    load();
  }

  const classOptions = (classes ?? []).map((teacherClass) => ({
    id: teacherClass.classId,
    name: teacherClass.className,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark today's register, or open a past day this term to correct it."
      />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your classes…
        </div>
      )}
      {classes !== null && classes.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No classes to register"
          description="You'll see this page once you're assigned as a class teacher."
        />
      )}

      {classes !== null && classes.length > 0 && (
        <StickySubHeader>
          <ClassDatePicker
            classes={classOptions}
            classId={effectiveClassId}
            onClassChange={setClassId}
            date={date}
            onDateChange={setDate}
            disableWeekends={!allowWeekendAttendance}
          />
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {register && !register.editable && (
        <Alert variant="warning">
          This register is read-only for {date} — it falls outside the current term or is no longer
          open for correction.
        </Alert>
      )}

      {register && register.rows.length === 0 && (
        <EmptyState
          title="Nobody to register"
          description="No students are enrolled in this class for this session."
        />
      )}
      {register && register.rows.length > 0 && (
        <AttendanceRegisterGrid register={register} onSaved={handleSaved} />
      )}

      {outcomes && (
        <AttendanceOutcomeList
          outcomes={outcomes}
          nameOf={(studentId) =>
            register?.rows.find((row) => row.studentId === studentId)?.studentName ?? studentId
          }
        />
      )}
    </div>
  );
}
