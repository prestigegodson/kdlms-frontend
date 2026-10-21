import { apiFetch } from "@/api/client";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

/**
 * Mirrors backend shared.domain.AttendanceSession - which of a day's two
 * registers. A once-a-day school only ever has MORNING registers; one with
 * School Settings' twoSessionAttendance on also takes AFTERNOON.
 */
export type AttendanceSession = "MORNING" | "AFTERNOON";

/** Mirrors backend attendance.application.port.in.AttendanceRegisterView.RegisterRowView. */
export interface RegisterRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status?: AttendanceStatus;
  recordedByName?: string;
}

/**
 * Mirrors backend attendance.application.port.in.AttendanceRegisterView - a
 * class's register for one day. `editable` tells the frontend whether
 * `saveRegister` would succeed for this exact class/date/caller, so it
 * doesn't have to re-derive the class-teacher/current-term/not-future rule.
 */
export interface AttendanceRegisterView {
  classId: string;
  className: string;
  date: string;
  session: AttendanceSession;
  termId: string;
  editable: boolean;
  rows: RegisterRow[];
}

/** Mirrors backend attendance.application.port.in.MarkAttendanceUseCase.RowOutcome - same per-row contract as score/rating saves. */
export interface RowOutcome {
  studentId: string;
  success: boolean;
  message?: string;
}

export interface SaveOutcome {
  outcomes: RowOutcome[];
}

export interface EntryInput {
  studentId: string;
  status: AttendanceStatus;
}

/** Mirrors backend attendance.application.port.in.ClassAttendanceSummaryView.StudentSummaryRow. */
export interface StudentSummaryRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  daysMarked: number;
  attendanceRate: number;
}

/** Mirrors backend attendance.application.port.in.ClassAttendanceSummaryView - a class's per-student totals for one term. */
export interface ClassAttendanceSummaryView {
  classId: string;
  className: string;
  termId: string;
  rows: StudentSummaryRow[];
}

/** Mirrors backend attendance.application.port.in.StudentAttendanceSummaryView.DayEntryView - a two-session school has up to two per date, morning first. */
export interface DayEntry {
  date: string;
  session: AttendanceSession;
  status: AttendanceStatus;
}

/** Mirrors backend attendance.application.port.in.StudentAttendanceSummaryView - one student's day-by-day term attendance. */
export interface StudentAttendanceSummaryView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  termId: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  daysMarked: number;
  attendanceRate: number;
  days: DayEntry[];
}

/** Mirrors backend attendance.application.port.in.AttendanceOverviewView.ClassOverviewRow. */
export interface ClassOverviewRow {
  classId: string;
  className: string;
  levelId: string;
  levelName?: string;
  marked: boolean;
  studentsMarked: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

/** Mirrors backend attendance.application.port.in.AttendanceOverviewView - today's (or any day's) marking status across every class in scope. */
export interface AttendanceOverviewView {
  date: string;
  session: AttendanceSession;
  totalClasses: number;
  classesMarked: number;
  classes: ClassOverviewRow[];
}

const BASE = "/api/v1/attendance";

export function getRegister(
  classId: string,
  date: string,
  session: AttendanceSession = "MORNING",
): Promise<AttendanceRegisterView> {
  return apiFetch<AttendanceRegisterView>(
    `${BASE}/register?classId=${classId}&date=${date}&session=${session}`,
  );
}

export function saveRegister(
  classId: string,
  date: string,
  session: AttendanceSession,
  entries: EntryInput[],
): Promise<SaveOutcome> {
  return apiFetch<SaveOutcome>(`${BASE}/register`, {
    method: "PUT",
    body: JSON.stringify({ classId, date, session, entries }),
  });
}

/** `session` narrows the totals to one register of the day; omitted, every session counts. */
export function getClassTermSummary(
  classId: string,
  termId: string,
  session?: AttendanceSession,
): Promise<ClassAttendanceSummaryView> {
  const sessionParam = session ? `&session=${session}` : "";
  return apiFetch<ClassAttendanceSummaryView>(
    `${BASE}/summary/class?classId=${classId}&termId=${termId}${sessionParam}`,
  );
}

export function getStudentTermSummary(
  studentId: string,
  termId: string,
): Promise<StudentAttendanceSummaryView> {
  return apiFetch<StudentAttendanceSummaryView>(
    `${BASE}/summary/students/${studentId}?termId=${termId}`,
  );
}

export function getDailyOverview(
  date: string,
  branchId?: string,
  session: AttendanceSession = "MORNING",
): Promise<AttendanceOverviewView> {
  const params = new URLSearchParams({ date, session });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<AttendanceOverviewView>(`${BASE}/overview?${params.toString()}`);
}
