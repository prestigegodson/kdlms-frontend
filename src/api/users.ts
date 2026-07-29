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

export function listUsers(page = 0, size = 20): Promise<Page<UserSummary>> {
  return apiFetch<Page<UserSummary>>(`/api/v1/users?page=${page}&size=${size}`);
}

export function enableUser(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/users/${userId}/enable`, { method: "PATCH" });
}

export function disableUser(userId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/users/${userId}/disable`, { method: "PATCH" });
}
