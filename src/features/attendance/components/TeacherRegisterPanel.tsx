import { useEffect, useState } from "react";
import {
  type AttendanceRegisterView,
  type AttendanceSession,
  clearRegister,
  getRegister,
  type RowOutcome,
} from "@/api/attendance";
import { ApiError } from "@/api/client";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import {
  AttendanceOutcomeList,
  AttendanceRegisterGrid,
} from "@/features/attendance/components/AttendanceRegisterGrid";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";
import { SessionToggle } from "@/features/attendance/components/SessionToggle";
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
 * today is a Saturday/Sunday - on the first class-taught class. A school that
 * takes two registers a day also picks Morning or Afternoon; each is its own
 * register. A teacher can also unmark a whole saved register (e.g. one
 * taken on the wrong day) while it's still editable.
 */
export function TeacherRegisterPanel({ initialClassId }: TeacherRegisterPanelProps = {}) {
  // Fetched by SchoolLayout's mount effect (same pattern as teacherScopeStore/
  // academicContextStore) - just read here.
  const allowWeekendAttendance = useSchoolSettingsStore(
    (state) => state.settings?.allowWeekendAttendance ?? false,
  );
  const twoSessionAttendance = useSchoolSettingsStore(
    (state) => state.settings?.twoSessionAttendance ?? false,
  );

  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [date, setDate] = useState(() => (allowWeekendAttendance ? todayIso() : mostRecentWeekdayIso()));
  const [selectedSession, setSession] = useState<AttendanceSession>("MORNING");
  // Turning two-session attendance off mid-session falls back to the morning register.
  const session: AttendanceSession = twoSessionAttendance ? selectedSession : "MORNING";

  const [register, setRegister] = useState<AttendanceRegisterView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[] | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [cleared, setCleared] = useState(false);

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
  const selectionKey = `${effectiveClassId}|${date}|${session}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setRegister(null);
    setOutcomes(null);
    setLoadError(null);
    setCleared(false);
  }

  function load() {
    if (!effectiveClassId || !date) return;
    getRegister(effectiveClassId, date, session)
      .then(setRegister)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the register"),
      );
  }

  useEffect(load, [effectiveClassId, date, session]);

  function handleSaved(rowOutcomes: RowOutcome[]) {
    setOutcomes(rowOutcomes);
    setCleared(false);
    load();
  }

  // Errors propagate so ConfirmDialog shows them inline and stays open.
  async function handleClear() {
    if (!register) return;
    await clearRegister(register.classId, register.date, register.session);
    setConfirmingClear(false);
    setOutcomes(null);
    setCleared(true);
    load();
  }

  const registerSaved = register?.rows.some((row) => row.status) ?? false;
  const sessionSuffix = twoSessionAttendance ? ` (${session.toLowerCase()})` : "";

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
          <Spinner /> Loading your classrooms…
        </div>
      )}
      {classes !== null && classes.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No classrooms to register"
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
          {twoSessionAttendance && (
            <SessionToggle
              session={session}
              onChange={(next) => setSession(next ?? "MORNING")}
            />
          )}
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {register && !register.editable && (
        <Alert variant="warning">
          This {twoSessionAttendance ? `${session.toLowerCase()} ` : ""}register is read-only for {date} —
          it falls outside the current term or is no longer
          open for correction.
        </Alert>
      )}

      {register && register.rows.length === 0 && (
        <EmptyState
          title="Nobody to register"
          description="No pupils are enrolled in this class for this session."
        />
      )}
      {cleared && (
        <Alert variant="success" title="Register unmarked">
          Every pupil&apos;s mark for {date}
          {sessionSuffix} has been removed. You can mark this register again.
        </Alert>
      )}

      {register && register.editable && registerSaved && (
        <div className="flex justify-end">
          <Button type="button" variant="accent" onClick={() => setConfirmingClear(true)}>
            Unmark register
          </Button>
        </div>
      )}

      {register && register.rows.length > 0 && (
        <AttendanceRegisterGrid register={register} onSaved={handleSaved} />
      )}

      {confirmingClear && register && (
        <ConfirmDialog
          title="Unmark this register?"
          message={`Every pupil's mark for ${register.className} on ${register.date}${sessionSuffix} will be removed, and the day will stop counting towards their term attendance. This can't be undone.`}
          confirmLabel="Unmark register"
          variant="danger"
          onConfirm={handleClear}
          onClose={() => setConfirmingClear(false)}
        />
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
