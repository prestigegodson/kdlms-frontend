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
  photoFileId?: string;
  status: StudentStatus;
  currentClassId?: string;
  currentClassName?: string;
  currentLevelId?: string;
  currentLevelName?: string;
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

export type BloodGroup =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";

export type Genotype = "AA" | "AS" | "SS" | "AC" | "SC";

/**
 * Mirrors backend student.application.port.in.StudentMedicalView - its own
 * resource, separate from StudentView, edited via GET/PUT .../medical.
 */
export interface StudentMedicalView {
  studentId: string;
  studentName: string;
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  disabilityNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  clinicName?: string;
  doctorPhone?: string;
}

/** Full-replace - every field optional, an omitted field clears it. */
export interface UpdateStudentMedicalRequest {
  bloodGroup?: BloodGroup;
  genotype?: Genotype;
  allergies?: string;
  medicalConditions?: string;
  medications?: string;
  disabilityNotes?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  clinicName?: string;
  doctorPhone?: string;
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

/**
 * Mirrors backend student.application.port.in.StudentTermView.
 * `resultsPublished`/`midtermPublished` are informational only here -
 * unlike a guardian, staff see recorded results regardless of publication
 * state.
 */
export interface StudentTermView {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  termId: string;
  termName: string;
  termNumber: number;
  classId: string;
  className?: string;
  levelId: string;
  resultsPublished: boolean;
  midtermPublished: boolean;
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

/**
 * Mirrors backend student.application.port.in.StudentSubjectsView - every
 * subject of the student's level for their current-session enrollment. A
 * mandatory (non-selective) row is always `registered: true`; a selective
 * row reflects whether the student is actually registered for it.
 */
export interface StudentSubjectsView {
  studentId: string;
  subjects: SubjectRegistrationRow[];
}

export interface SubjectRegistrationRow {
  subjectId: string;
  name: string;
  code?: string;
  selective: boolean;
  registered: boolean;
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

export interface GraduateClassRequest {
  classId: string;
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

/** {@code photoFileId} may be {@code null} to clear a previously-set photo. */
export function updateStudentPhoto(studentId: string, photoFileId: string | null): Promise<StudentView> {
  return apiFetch<StudentView>(`${BASE}/${studentId}/photo`, {
    method: "PATCH",
    body: JSON.stringify({ photoFileId }),
  });
}

export function getStudentMedical(studentId: string): Promise<StudentMedicalView> {
  return apiFetch<StudentMedicalView>(`${BASE}/${studentId}/medical`);
}

export function updateStudentMedical(
  studentId: string,
  request: UpdateStudentMedicalRequest,
): Promise<StudentMedicalView> {
  return apiFetch<StudentMedicalView>(`${BASE}/${studentId}/medical`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export interface ListStudentsFilter {
  branchId?: string;
  classId?: string;
  sessionId?: string;
  status?: StudentStatus;
  /** `true`/`false` narrows to students with/without at least one active linked guardian; omitted applies no such filter. */
  hasGuardian?: boolean;
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
  if (filter.hasGuardian !== undefined) params.set("hasGuardian", String(filter.hasGuardian));
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

/** Every term of every session the student has ever been enrolled for - backs the result-history drill-down. */
export function listStudentTerms(studentId: string): Promise<StudentTermView[]> {
  return apiFetch<StudentTermView[]>(`${BASE}/${studentId}/terms`);
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

/**
 * Every subject of the student's level, mandatory ones always registered,
 * selective ones flagged registered or not - for the current staff caller
 * (admin path). A class teacher reads/writes the same data through
 * `getMyStudentSubjects`/`replaceMyStudentSubjects` (`/api/v1/me/...`)
 * instead - both resolve to the same backend use case and guard.
 */
export function getStudentSubjects(studentId: string): Promise<StudentSubjectsView> {
  return apiFetch<StudentSubjectsView>(`${BASE}/${studentId}/subjects`);
}

/** Full replace - `subjectIds` is the complete desired set of selective subjects; mandatory ones are never submitted. */
export function replaceStudentSubjects(studentId: string, subjectIds: string[]): Promise<StudentSubjectsView> {
  return apiFetch<StudentSubjectsView>(`${BASE}/${studentId}/subjects`, {
    method: "PUT",
    body: JSON.stringify({ subjectIds }),
  });
}

/** Same resource as {@link getStudentSubjects}, scoped to the calling TEACHER's own class-taught student. */
export function getMyStudentSubjects(studentId: string): Promise<StudentSubjectsView> {
  return apiFetch<StudentSubjectsView>(`/api/v1/me/students/${studentId}/subjects`);
}

export function replaceMyStudentSubjects(studentId: string, subjectIds: string[]): Promise<StudentSubjectsView> {
  return apiFetch<StudentSubjectsView>(`/api/v1/me/students/${studentId}/subjects`, {
    method: "PUT",
    body: JSON.stringify({ subjectIds }),
  });
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

/** Bulk graduation of selected students of one class - the end-of-year counterpart to {@link graduateStudent}. */
export function graduateClass(request: GraduateClassRequest): Promise<MovementResult> {
  return apiFetch<MovementResult>(`${BASE}/graduations`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** Mirrors backend student.domain.AgeDistribution.AgeBand. */
export interface AgeBand {
  age: number;
  count: number;
}

/**
 * Mirrors backend student.domain.AgeDistribution - the school dashboard's
 * "Age distribution" card. `bands` is sparse (one entry per age that has at
 * least one student, ascending, no zero-filled gap years); `totalStudents`
 * counts every ACTIVE student including `unknownAge` (no date of birth on
 * file, or one after today).
 */
export interface AgeDistribution {
  bands: AgeBand[];
  totalStudents: number;
  unknownAge: number;
}

/** SCHOOL_ADMIN sees the whole school, BRANCH_ADMIN their own branch - resolved server-side from the caller's token. */
export function getStudentAgeDistribution(): Promise<AgeDistribution> {
  return apiFetch<AgeDistribution>(`${BASE}/age-distribution`);
}
