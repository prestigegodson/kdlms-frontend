import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type StudentStatus = "ACTIVE" | "GRADUATED" | "WITHDRAWN";
export type Gender = "MALE" | "FEMALE";

/** Mirrors backend student.application.port.in.StudentView. */
export interface StudentView {
  id: string;
  schoolId: string;
  branchId: string;
  branchName?: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  fullName: string;
  gender: Gender;
  dateOfBirth?: string;
  status: StudentStatus;
  currentClassId?: string;
  currentClassName?: string;
  currentSessionId?: string;
}

export interface RegisterStudentRequest {
  /** Required for a SCHOOL_ADMIN caller; ignored (the caller's own branch is used) for a BRANCH_ADMIN caller. */
  branchId?: string;
  classId: string;
  /** Blank/omitted allocates the server's default `<SCHOOL_CODE>/<year>/<0001>` sequence. */
  admissionNumber?: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  gender: Gender;
  dateOfBirth?: string;
}

export interface UpdateStudentRequest {
  firstName: string;
  lastName: string;
  otherName?: string;
  gender: Gender;
  dateOfBirth?: string;
}

/** Mirrors backend student.application.port.in.EnrollmentView. */
export interface EnrollmentView {
  id: string;
  studentId: string;
  classId: string;
  className?: string;
  sessionId: string;
  enrollmentType: "NEW" | "PROMOTED" | "TRANSFERRED";
  enrolledAt: string;
  status: "ACTIVE" | "COMPLETED" | "WITHDRAWN";
}

/** Mirrors backend student.application.port.in.StudentGuardianView. */
export interface StudentGuardianView {
  guardianId: string;
  guardianName: string;
  email: string;
  phone?: string;
  relationship: string;
}

/** Mirrors backend student.application.port.in.ManageEnrollmentsUseCase.StudentOutcome/MovementResult. */
export interface StudentOutcome {
  studentId: string;
  success: boolean;
  message?: string;
}

export interface MovementResult {
  outcomes: StudentOutcome[];
}

export interface PlacementRequest {
  targetClassId: string;
  sessionId: string;
  studentIds: string[];
}

export interface PromotionRequest {
  sourceClassId: string;
  targetClassId: string;
  targetSessionId: string;
  studentIds: string[];
}

const BASE = "/api/v1/students";

export function registerStudent(request: RegisterStudentRequest): Promise<StudentView> {
  return apiFetch<StudentView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function getStudent(studentId: string): Promise<StudentView> {
  return apiFetch<StudentView>(`${BASE}/${studentId}`);
}

export function updateStudent(studentId: string, request: UpdateStudentRequest): Promise<StudentView> {
  return apiFetch<StudentView>(`${BASE}/${studentId}`, { method: "PUT", body: JSON.stringify(request) });
}

export interface ListStudentsFilter {
  branchId?: string;
  classId?: string;
  sessionId?: string;
  status?: StudentStatus;
  q?: string;
}

export function listStudents(
  filter: ListStudentsFilter = {},
  page = 0,
  size = 20,
): Promise<Page<StudentView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filter.branchId) params.set("branchId", filter.branchId);
  if (filter.classId) params.set("classId", filter.classId);
  if (filter.sessionId) params.set("sessionId", filter.sessionId);
  if (filter.status) params.set("status", filter.status);
  if (filter.q) params.set("q", filter.q);
  return apiFetch<Page<StudentView>>(`${BASE}?${params.toString()}`);
}

export function graduateStudent(studentId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${studentId}/graduate`, { method: "PATCH" });
}

export function withdrawStudent(studentId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${studentId}/withdraw`, { method: "PATCH" });
}

export function reinstateStudent(studentId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${studentId}/reinstate`, { method: "PATCH" });
}

export function listStudentEnrollments(studentId: string): Promise<EnrollmentView[]> {
  return apiFetch<EnrollmentView[]>(`${BASE}/${studentId}/enrollments`);
}

/** Same-session transfer to a different class in the student's own branch. */
export function transferStudentClass(studentId: string, classId: string): Promise<StudentView> {
  return apiFetch<StudentView>(`${BASE}/${studentId}/enrollments/current-class`, {
    method: "PUT",
    body: JSON.stringify({ classId }),
  });
}

export function listStudentGuardians(studentId: string): Promise<StudentGuardianView[]> {
  return apiFetch<StudentGuardianView[]>(`${BASE}/${studentId}/guardians`);
}

/** Search-and-place: individually selected students (typically from a lower level/class) into a target class/session. */
export function placeStudents(request: PlacementRequest): Promise<MovementResult> {
  return apiFetch<MovementResult>("/api/v1/enrollments/placements", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Bulk promotion of a whole source class's roster into a target class/session. */
export function promoteStudents(request: PromotionRequest): Promise<MovementResult> {
  return apiFetch<MovementResult>("/api/v1/enrollments/promotions", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
