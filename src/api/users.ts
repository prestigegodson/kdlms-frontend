import type { UserSummary } from "@/api/auth";
import { apiFetch } from "@/api/client";
import type { Page, Role } from "@/api/types";

export type UserStatus = "ACTIVE" | "DISABLED";

/** Mirrors backend identity.application.port.in.SchoolUserView - the system-admin console's own view. */
export interface SchoolUserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  branchId?: string;
  branchName?: string;
  status: UserStatus;
  createdAt: string;
}

export interface CreateSchoolAdminRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CreateBranchAdminRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  branchId: string;
}

/** {@code temporaryPassword} is generated server-side and returned exactly once. */
export interface CreateUserResult {
  user: UserSummary;
  temporaryPassword: string;
}

export function createSchoolAdmin(
  schoolId: string,
  request: CreateSchoolAdminRequest,
): Promise<CreateUserResult> {
  return apiFetch<CreateUserResult>(`/api/v1/admin/schools/${schoolId}/users`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** System admin's view of a school's SCHOOL_ADMIN/BRANCH_ADMIN users - teachers/guardians aren't included. */
export function listSchoolAdmins(schoolId: string, page = 0, size = 20): Promise<Page<SchoolUserView>> {
  return apiFetch<Page<SchoolUserView>>(
    `/api/v1/admin/schools/${schoolId}/users?page=${page}&size=${size}`,
  );
}

/** {@code temporaryPassword} is generated server-side and returned exactly once. */
export interface ResetPasswordResult {
  user: SchoolUserView;
  temporaryPassword: string;
}

/** Issues a fresh temporary password for one of the school's admins, revoking their current session. */
export function resetUserPassword(schoolId: string, userId: string): Promise<ResetPasswordResult> {
  return apiFetch<ResetPasswordResult>(`/api/v1/admin/schools/${schoolId}/users/${userId}/password-reset`, {
    method: "POST",
  });
}

export function createBranchAdmin(request: CreateBranchAdminRequest): Promise<CreateUserResult> {
  return apiFetch<CreateUserResult>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** The caller's own school's SCHOOL_ADMIN/BRANCH_ADMIN users (teachers/guardians excluded) - the school portal's own Administrators screen. */
export function listAdmins(page = 0, size = 20): Promise<Page<SchoolUserView>> {
  return apiFetch<Page<SchoolUserView>>(`/api/v1/users?page=${page}&size=${size}`);
}

/** {@code branchId} isn't here - a branch admin's branch isn't editable, see the backend's {@code User#updateDetails}. */
export interface UpdateBranchAdminRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export function updateBranchAdmin(userId: string, request: UpdateBranchAdminRequest): Promise<SchoolUserView> {
  return apiFetch<SchoolUserView>(`/api/v1/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export interface CreateTeacherRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  /** Required for a SCHOOL_ADMIN caller; ignored (the caller's own branch is used) for a BRANCH_ADMIN caller. */
  branchId?: string;
}

export function createTeacher(request: CreateTeacherRequest): Promise<CreateUserResult> {
  return apiFetch<CreateUserResult>("/api/v1/users/teachers", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function listTeachers(branchId?: string, page = 0, size = 20): Promise<Page<UserSummary>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<Page<UserSummary>>(`/api/v1/users/teachers?${params.toString()}`);
}

/** Branch isn't here - a teacher's branch isn't editable, see the backend's {@code User#updateDetails}. */
export interface UpdateTeacherRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export function updateTeacher(userId: string, request: UpdateTeacherRequest): Promise<UserSummary> {
  return apiFetch<UserSummary>(`/api/v1/users/teachers/${userId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/** {@code signatureFileId} may be {@code null} to clear a previously-set signature - the class-teacher signature slot on a printed result report (Phase 7). */
export function updateTeacherSignature(userId: string, signatureFileId: string | null): Promise<UserSummary> {
  return apiFetch<UserSummary>(`/api/v1/users/teachers/${userId}/signature`, {
    method: "PATCH",
    body: JSON.stringify({ signatureFileId }),
  });
}

/** What removing this teacher would clear - fetched before the confirmation prompt is shown. */
export interface TeacherRemovalImpact {
  classTeacherOf: string[];
  subjectAssignmentCount: number;
}

export function getTeacherRemovalImpact(userId: string): Promise<TeacherRemovalImpact> {
  return apiFetch<TeacherRemovalImpact>(`/api/v1/users/teachers/${userId}/removal-impact`);
}

/**
 * Soft-deletes the teacher's account - terminal, releases their email for
 * reuse at this school or another. Clears their class-teacher/subject-
 * teacher assignments; recorded scores, attendance, and communication
 * history are untouched.
 */
export function removeTeacher(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/users/teachers/${userId}`, { method: "DELETE" });
}

export function enableUser(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/users/${userId}/enable`, { method: "PATCH" });
}

export function disableUser(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/users/${userId}/disable`, { method: "PATCH" });
}
