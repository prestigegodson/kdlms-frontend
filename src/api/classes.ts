import { apiFetch } from "@/api/client";
import type { RosterStudentView } from "@/api/me";
import type { MovementResult } from "@/api/students";
import type { Page } from "@/api/types";

export type { RosterStudentView };

export type ClassStatus = "ACTIVE" | "INACTIVE";

/** Mirrors backend academics.application.port.in.SchoolClassView. */
export interface SchoolClassView {
  id: string;
  schoolId: string;
  branchId: string;
  levelId: string;
  name: string;
  classTeacherId?: string;
  classTeacherName?: string;
  status: ClassStatus;
}

export interface CreateClassRequest {
  /** Required for a SCHOOL_ADMIN caller; ignored (the caller's own branch is used) for a BRANCH_ADMIN caller. */
  branchId?: string;
  levelId: string;
  name: string;
}

export interface UpdateClassRequest {
  name: string;
  levelId: string;
}

/** Mirrors backend academics.application.port.in.SubjectTeacherView. */
export interface SubjectTeacherView {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

const BASE = "/api/v1/classes";

export function listClasses(
  branchId?: string,
  levelId?: string,
  page = 0,
  size = 50,
): Promise<Page<SchoolClassView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (branchId) params.set("branchId", branchId);
  if (levelId) params.set("levelId", levelId);
  return apiFetch<Page<SchoolClassView>>(`${BASE}?${params.toString()}`);
}

export function getClass(classId: string): Promise<SchoolClassView> {
  return apiFetch<SchoolClassView>(`${BASE}/${classId}`);
}

/**
 * The current session's roster for a class - SCHOOL_ADMIN, BRANCH_ADMIN
 * (own branch), and an assigned TEACHER; 404s (not 403) for a class the
 * caller can't see. Bounded to one class's roster, so no paging.
 */
export function listClassStudents(classId: string): Promise<RosterStudentView[]> {
  return apiFetch<RosterStudentView[]>(`${BASE}/${classId}/students`);
}

export function createClass(request: CreateClassRequest): Promise<SchoolClassView> {
  return apiFetch<SchoolClassView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateClass(classId: string, request: UpdateClassRequest): Promise<SchoolClassView> {
  return apiFetch<SchoolClassView>(`${BASE}/${classId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function assignClassTeacher(classId: string, teacherId: string): Promise<SchoolClassView> {
  return apiFetch<SchoolClassView>(`${BASE}/${classId}/class-teacher`, {
    method: "PUT",
    body: JSON.stringify({ teacherId }),
  });
}

export function unassignClassTeacher(classId: string): Promise<SchoolClassView> {
  return apiFetch<SchoolClassView>(`${BASE}/${classId}/class-teacher`, { method: "DELETE" });
}

export function activateClass(classId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${classId}/activate`, { method: "PATCH" });
}

export function deactivateClass(classId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${classId}/deactivate`, { method: "PATCH" });
}

export function listSubjectTeachers(classId: string): Promise<SubjectTeacherView[]> {
  return apiFetch<SubjectTeacherView[]>(`${BASE}/${classId}/subject-teachers`);
}

/** Assigning over an existing (subject, class) pair replaces the prior assignment. */
export function assignSubjectTeacher(
  classId: string,
  subjectId: string,
  teacherId: string,
): Promise<SubjectTeacherView> {
  return apiFetch<SubjectTeacherView>(`${BASE}/${classId}/subject-teachers`, {
    method: "POST",
    body: JSON.stringify({ subjectId, teacherId }),
  });
}

export function unassignSubjectTeacher(classId: string, subjectId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${classId}/subject-teachers/${subjectId}`, { method: "DELETE" });
}

/** Mirrors backend student.application.port.in.SubjectRegistrationView. */
export interface SubjectRegistrationView {
  classId: string;
  subjectId: string;
  subjectName: string;
  students: StudentRegistrationRow[];
}

export interface StudentRegistrationRow {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  registered: boolean;
}

/** One selective subject's registered/unregistered state across the class's current-session roster. */
export function getSubjectRegistrations(classId: string, subjectId: string): Promise<SubjectRegistrationView> {
  return apiFetch<SubjectRegistrationView>(`${BASE}/${classId}/subjects/${subjectId}/students`);
}

/**
 * Bulk-sets the subject's registered roster to exactly `studentIds` - a
 * student on the roster but omitted here is unregistered. Returns a
 * per-student outcome (same shape as {@link MovementResult}), never fails
 * the whole batch for one bad row.
 */
export function setSubjectRegistrations(
  classId: string,
  subjectId: string,
  studentIds: string[],
): Promise<MovementResult> {
  return apiFetch<MovementResult>(`${BASE}/${classId}/subjects/${subjectId}/students`, {
    method: "PUT",
    body: JSON.stringify(studentIds),
  });
}
