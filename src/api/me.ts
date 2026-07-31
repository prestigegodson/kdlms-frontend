import { apiFetch } from "@/api/client";
import type { SubjectView } from "@/api/subjects";

/**
 * Self-service views for the currently authenticated TEACHER - "my classes",
 * "my subjects" - mirroring backend academics.adapter.in.web.TeacherAssignmentController.
 * TEACHER-only; a school/branch admin uses the catalogue endpoints instead
 * (api/classes.ts, api/subjects.ts).
 */
const BASE = "/api/v1/me";

/** Mirrors backend academics.application.port.in.TeacherClassView. */
export interface TeacherClassView {
  classId: string;
  branchId: string;
  levelId: string;
  levelName?: string;
  className: string;
  isClassTeacher: boolean;
  subjectIds: string[];
}

/** Mirrors backend academics.application.port.in.TeacherSubjectAssignmentView. */
export interface TeacherSubjectAssignmentView {
  classId: string;
  className: string;
  levelId?: string;
  levelName?: string;
  subjectId: string;
  subjectName: string;
}

/**
 * Mirrors backend academics.application.port.in.TeacherCapabilitiesView.
 * {@code currentTermNumber}/{@code currentTermName} are undefined when the
 * school hasn't marked a term current - every subject/class list below then
 * falls back to showing everything, unfiltered.
 */
export interface TeacherCapabilities {
  isClassTeacher: boolean;
  classTeacherClassIds: string[];
  subjectTeacherClassIds: string[];
  currentTermNumber?: number;
  currentTermName?: string;
}

/** Every class the caller class-teaches or subject-teaches. */
export function listMyClasses(): Promise<TeacherClassView[]> {
  return apiFetch<TeacherClassView[]>(`${BASE}/classes`);
}

/** Every (class, subject) the caller is the assigned subject teacher for. */
export function listMySubjects(): Promise<TeacherSubjectAssignmentView[]> {
  return apiFetch<TeacherSubjectAssignmentView[]>(`${BASE}/subjects`);
}

/**
 * Subjects the caller may record a score/rating for in {@code classId} -
 * every subject of the class's level if they're its class teacher, otherwise
 * only the subjects they're individually assigned there.
 */
export function listRecordableSubjects(classId: string): Promise<SubjectView[]> {
  return apiFetch<SubjectView[]>(`${BASE}/classes/${classId}/recordable-subjects`);
}

/** Drives teacher-only nav (e.g. Attendance is class-teacher-only) - see auth/permissions.ts. */
export function getMyCapabilities(): Promise<TeacherCapabilities> {
  return apiFetch<TeacherCapabilities>(`${BASE}/capabilities`);
}

/** Mirrors backend student.application.port.in.RosterStudentView - name, admission number, gender only. */
export interface RosterStudentView {
  studentId: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  fullName: string;
  admissionNumber: string;
  gender: "MALE" | "FEMALE";
}

/**
 * The current session's roster for a class the caller class-teaches or
 * subject-teaches - 404s (not 403) for a class they aren't assigned to,
 * matching {@link listRecordableSubjects}'s scoping.
 */
export function listClassRoster(classId: string): Promise<RosterStudentView[]> {
  return apiFetch<RosterStudentView[]>(`${BASE}/classes/${classId}/students`);
}
