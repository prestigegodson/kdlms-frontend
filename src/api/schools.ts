import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type SchoolStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

/** Mirrors backend school.application.port.in.SchoolView. */
export interface SchoolView {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  status: SchoolStatus;
}

export interface CreateSchoolRequest {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  mainBranchName?: string;
}

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

export function updateSchool(schoolId: string, request: UpdateSchoolRequest): Promise<SchoolView> {
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
