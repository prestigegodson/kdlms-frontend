import { apiFetch } from "@/api/client";

export type PeriodKind = "TEACHING" | "BREAK";

/** Mirrors backend timetable.application.port.in.LevelPeriodGridView.PeriodView. */
export interface PeriodView {
  id: string;
  position: number;
  label: string;
  startTime: string;
  endTime: string;
  kind: PeriodKind;
  /** Whether any timetable entry (Phase 12C) references this period - a delete or TEACHING-to-BREAK flip is refused server-side while true. */
  inUse: boolean;
}

/** Mirrors backend timetable.application.port.in.LevelPeriodGridView. */
export interface LevelPeriodGridView {
  levelId: string;
  levelName: string;
  periods: PeriodView[];
}

/** Mirrors backend timetable.application.port.in.ManagePeriodGridUseCase.PeriodCommand - a null id means "new period". */
export interface PeriodCommand {
  id: string | null;
  label: string;
  startTime: string;
  endTime: string;
  kind: PeriodKind;
}

export interface SavePeriodGridRequest {
  periods: PeriodCommand[];
}

const BASE = "/api/v1/timetable";

/** Every active level of the school, rank order, each with its current grid. */
export function listPeriodGrids(): Promise<LevelPeriodGridView[]> {
  return apiFetch<LevelPeriodGridView[]>(`${BASE}/periods`);
}

export function getPeriodGrid(levelId: string): Promise<LevelPeriodGridView> {
  return apiFetch<LevelPeriodGridView>(`${BASE}/periods/${levelId}`);
}

/** Full replace, ids preserved - see ManagePeriodGridUseCase's Javadoc for the edit-locking rules this enforces server-side. */
export function savePeriodGrid(levelId: string, request: SavePeriodGridRequest): Promise<LevelPeriodGridView> {
  return apiFetch<LevelPeriodGridView>(`${BASE}/periods/${levelId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export type EntryKind = "SUBJECT" | "ACTIVITY";

/** Mirrors backend timetable.application.port.in.ClassTimetableView.CellView. */
export interface TimetableCellView {
  entryId: string | null;
  entryKind: EntryKind;
  subjectId: string | null;
  subjectName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  label: string | null;
}

/** Mirrors backend timetable.application.port.in.ClassTimetableView.PeriodRow - `cellsByDay` is keyed by dayOfWeek (1=Mon..7=Sun) as a string, per JSON object-key coercion. */
export interface TimetablePeriodRow {
  periodId: string;
  position: number;
  label: string;
  startTime: string;
  endTime: string;
  kind: PeriodKind;
  cellsByDay: Record<string, TimetableCellView>;
}

/**
 * Mirrors backend timetable.application.port.in.ClassTimetableView. `editable`
 * tells the frontend whether `saveClassTimetable` would succeed for this
 * exact class/term/caller (SCHOOL_ADMIN/BRANCH_ADMIN, own branch) - the
 * `AttendanceRegisterView.editable` idiom. `suggestedTeachers` (subjectId ->
 * teacherId) pre-fills a newly-picked subject's teacher on an empty cell; the
 * select stays editable (override).
 */
export interface ClassTimetableView {
  classId: string;
  className: string;
  termId: string;
  editable: boolean;
  periods: TimetablePeriodRow[];
  suggestedTeachers: Record<string, string>;
}

/** Mirrors backend timetable.application.port.in.ManageClassTimetableUseCase.CellCommand - a blank entryKind clears the cell. */
export interface CellCommand {
  dayOfWeek: number;
  periodId: string;
  entryKind: EntryKind | "";
  subjectId: string | null;
  teacherId: string | null;
  label: string | null;
}

/** Mirrors backend timetable.application.port.in.ManageClassTimetableUseCase.RowOutcome - keyed by (dayOfWeek, periodId), not an id. */
export interface TimetableRowOutcome {
  dayOfWeek: number;
  periodId: string;
  entryId: string | null;
  success: boolean;
  message: string | null;
}

export interface TimetableSaveOutcome {
  outcomes: TimetableRowOutcome[];
}

/** Mirrors backend timetable.application.port.in.ManageClassTimetableUseCase.ClassCopyOutcome. */
export interface ClassCopyOutcome {
  classId: string;
  className: string;
  success: boolean;
  copied: number;
  skipped: number;
  message: string | null;
}

export interface CopyResult {
  outcomes: ClassCopyOutcome[];
}

export function getClassTimetable(classId: string, termId: string): Promise<ClassTimetableView> {
  return apiFetch<ClassTimetableView>(`${BASE}/classes/${classId}?termId=${termId}`);
}

export function saveClassTimetable(
  classId: string,
  termId: string,
  cells: CellCommand[],
): Promise<TimetableSaveOutcome> {
  return apiFetch<TimetableSaveOutcome>(`${BASE}/classes/${classId}?termId=${termId}`, {
    method: "PUT",
    body: JSON.stringify({ cells }),
  });
}

export function copyClassTimetables(
  sourceTermId: string,
  targetTermId: string,
  classIds: string[],
): Promise<CopyResult> {
  return apiFetch<CopyResult>(`${BASE}/classes/copy`, {
    method: "POST",
    body: JSON.stringify({ sourceTermId, targetTermId, classIds }),
  });
}

/** Mirrors backend timetable.application.port.in.TeacherWeekView.MyEntryView. */
export interface MyTimetableEntryView {
  entryId: string;
  dayOfWeek: number;
  periodId: string;
  periodLabel: string;
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  entryKind: EntryKind;
  subjectId: string | null;
  subjectName: string | null;
  label: string | null;
}

/** Mirrors backend timetable.application.port.in.TeacherWeekView - the calling TEACHER's own scheduled periods, across every class, day/time-sorted. */
export interface TeacherWeekView {
  termId: string;
  entries: MyTimetableEntryView[];
}

const ME_BASE = "/api/v1/me/timetable";

/** "My timetable" tab - every period the caller is scheduled for, sourced from `timetable_entries.teacher_id` alone. */
export function getMyTimetable(termId: string): Promise<TeacherWeekView> {
  return apiFetch<TeacherWeekView>(`${ME_BASE}?termId=${termId}`);
}

/** "Class timetable" tab - the full grid of each class the caller class-teaches; empty for a subject-teacher-only account. */
export function getMyClassTimetables(termId: string): Promise<ClassTimetableView[]> {
  return apiFetch<ClassTimetableView[]>(`${ME_BASE}/classes?termId=${termId}`);
}
