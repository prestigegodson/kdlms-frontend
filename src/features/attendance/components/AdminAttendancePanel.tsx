import { useEffect, useState } from "react";
import {
  type AttendanceRegisterView,
  type ClassAttendanceSummaryView,
  getClassTermSummary,
  getRegister,
} from "@/api/attendance";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { AttendanceRegisterGrid } from "@/features/attendance/components/AttendanceRegisterGrid";
import { AttendanceTodayCard } from "@/features/attendance/components/AttendanceTodayCard";
import { ClassAttendanceSummaryTable } from "@/features/attendance/components/ClassAttendanceSummaryTable";
import { ClassDatePicker } from "@/features/attendance/components/ClassDatePicker";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { StudentAttendanceCard } from "@/features/attendance/components/StudentAttendanceCard";
import { todayIso } from "@/utils/date";
import { BarChart3 } from "lucide-react";

type Tab = "day" | "term";

interface AdminAttendancePanelProps {
  /** Seeds the Day-register and Term-summary tabs' initial class selection (e.g. from ClassDetailPage's "Attendance register" quick link). */
  initialClassId?: string;
}

/**
 * An admin's read-only view: today's marking-status rollup up top, then a
 * choice between one day's register (any class, any date) and one term's
 * per-student totals - never anything to mark, matching CLAUDE.md's
 * class-teacher-write/admin-read rule for attendance.
 */
export function AdminAttendancePanel({ initialClassId }: AdminAttendancePanelProps = {}) {
  const [tab, setTab] = useState<Tab>("day");
  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);

  useEffect(() => {
    listClasses(undefined, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, []);

  const classOptions = (classes ?? []).map((schoolClass) => ({
    id: schoolClass.id,
    name: schoolClass.name,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Review a class's daily register or its totals for a term."
      />

      <AttendanceTodayCard />

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "day"} onClick={() => setTab("day")}>
          Day register
        </TabButton>
        <TabButton active={tab === "term"} onClick={() => setTab("term")}>
          Term summary
        </TabButton>
      </div>

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}

      {classes !== null && classes.length > 0 && tab === "day" && (
        <DayRegisterTab classOptions={classOptions} initialClassId={initialClassId} />
      )}
      {classes !== null && classes.length > 0 && tab === "term" && (
        <TermSummaryTab classOptions={classOptions} initialClassId={initialClassId} />
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: string;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control px-3 py-1.5 text-sm font-medium ${
        active ? "bg-brand-50 text-brand-800" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

interface ClassOption {
  id: string;
  name: string;
}

function DayRegisterTab({ classOptions, initialClassId }: { classOptions: ClassOption[]; initialClassId?: string }) {
  const [classId, setClassId] = useState(initialClassId ?? classOptions[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [register, setRegister] = useState<AttendanceRegisterView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A selection change resets downstream state during render (see ScoreEntryGrid's
  // comment on this pattern) rather than in an effect; the effect below only fetches.
  const selectionKey = `${classId}|${date}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setRegister(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId || !date) return;
    getRegister(classId, date)
      .then(setRegister)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the register"),
      );
  }, [classId, date]);

  return (
    <div className="space-y-4">
      <StickySubHeader>
        <ClassDatePicker
          classes={classOptions}
          classId={classId}
          onClassChange={setClassId}
          date={date}
          onDateChange={setDate}
        />
      </StickySubHeader>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {register && register.rows.length === 0 && (
        <EmptyState
          title="No students enrolled"
          description="No students are enrolled in this class for this session."
        />
      )}
      {register && register.rows.length > 0 && register.rows.every((row) => !row.status) && (
        <Alert variant="info">Nobody has marked this register yet.</Alert>
      )}
      {register && register.rows.length > 0 && (
        <AttendanceRegisterGrid register={register} onSaved={() => undefined} />
      )}
    </div>
  );
}

function TermSummaryTab({ classOptions, initialClassId }: { classOptions: ClassOption[]; initialClassId?: string }) {
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [termId, setTermId] = useState("");
  const [summary, setSummary] = useState<ClassAttendanceSummaryView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const selectionKey = `${classId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSummary(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getClassTermSummary(classId, termId)
      .then(setSummary)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the summary"),
      );
  }, [classId, termId]);

  return (
    <div className="space-y-4">
      <StickySubHeader>
        <ClassTermPicker
          classes={classOptions}
          classId={classId}
          onClassChange={setClassId}
          termId={termId}
          onTermChange={setTermId}
        />
      </StickySubHeader>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {summary && summary.rows.length === 0 && (
        <EmptyState icon={BarChart3} title="No attendance recorded for this term yet" />
      )}
      {summary && summary.rows.length > 0 && (
        <ClassAttendanceSummaryTable summary={summary} onSelectStudent={setSelectedStudentId} />
      )}

      {selectedStudentId && (
        <Modal open onClose={() => setSelectedStudentId(null)} title="Student attendance">
          <StudentAttendanceCard studentId={selectedStudentId} />
        </Modal>
      )}
    </div>
  );
}
