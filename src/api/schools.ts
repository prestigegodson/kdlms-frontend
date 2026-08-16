import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type SchoolStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

/** Mirrors backend school.application.port.in.SchoolView. `subdomain` is undefined when the school has none assigned. */
export interface SchoolView {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  /** The school's login-page subdomain (e.g. "greenwood" for greenwood.kdlms.com) - SYSTEM_ADMIN-set, read-only here. */
  subdomain?: string;
  status: SchoolStatus;
}

export interface CreateSchoolRequest {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  mainBranchName?: string;
  subdomain?: string;
}

/**
 * SYSTEM_ADMIN's `PUT /api/v1/admin/schools/{id}` - a full replace like
 * every PUT in this codebase, so an omitted `subdomain` clears it. Distinct
 * from {@link UpdateSchoolRequest}: only a system admin may set/change the
 * subdomain, matching `AdminSchoolController.UpdateSchoolRequest` vs
 * `SchoolProfileController.UpdateProfileRequest` on the backend.
 */
export interface AdminUpdateSchoolRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  subdomain?: string;
}

/** School-admin self-service `PUT /api/v1/school` - no `subdomain` field at all; that stays SYSTEM_ADMIN-only. */
export interface UpdateSchoolRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

const ADMIN_BASE = "/api/v1/admin/schools";

// System-admin school management.

export function listSchools(page = 0, size = 20): Promise<Page<SchoolView>> {
  return apiFetch<Page<SchoolView>>(`${ADMIN_BASE}?page=${page}&size=${size}`);
}

export function getSchool(schoolId: string): Promise<SchoolView> {
  return apiFetch<SchoolView>(`${ADMIN_BASE}/${schoolId}`);
}

export function createSchool(request: CreateSchoolRequest): Promise<SchoolView> {
  return apiFetch<SchoolView>(ADMIN_BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateSchool(schoolId: string, request: AdminUpdateSchoolRequest): Promise<SchoolView> {
  return apiFetch<SchoolView>(`${ADMIN_BASE}/${schoolId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function suspendSchool(schoolId: string): Promise<void> {
  return apiFetch<void>(`${ADMIN_BASE}/${schoolId}/suspend`, { method: "PATCH" });
}

export function activateSchool(schoolId: string): Promise<void> {
  return apiFetch<void>(`${ADMIN_BASE}/${schoolId}/activate`, { method: "PATCH" });
}

export function archiveSchool(schoolId: string): Promise<void> {
  return apiFetch<void>(`${ADMIN_BASE}/${schoolId}/archive`, { method: "PATCH" });
}

/** Un-archives the school - it returns to SUSPENDED, not ACTIVE; activate it separately. */
export function restoreSchool(schoolId: string): Promise<void> {
  return apiFetch<void>(`${ADMIN_BASE}/${schoolId}/restore`, { method: "PATCH" });
}

// School-admin self-service profile (the caller's own school - no id in the path).

export function getMySchoolProfile(): Promise<SchoolView> {
  return apiFetch<SchoolView>("/api/v1/school");
}

export function updateMySchoolProfile(request: UpdateSchoolRequest): Promise<SchoolView> {
  return apiFetch<SchoolView>("/api/v1/school", { method: "PUT", body: JSON.stringify(request) });
}
