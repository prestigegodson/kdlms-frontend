import type { UserSummary } from "@/api/auth";
import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

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
