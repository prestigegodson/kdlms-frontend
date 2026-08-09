import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend student.application.port.in.GuardianView. `id` is the guardian's underlying identity user id. */
export interface GuardianView {
  id: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  occupation?: string;
  address?: string;
  active: boolean;
  /** Whether this guardian receives communication-thread-started email - see CLAUDE.md's communication Domain Rules. */
  communicationEmailsEnabled: boolean;
}

export interface InitialWardLink {
  studentId: string;
  relationship: string;
}

export interface CreateGuardianRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  occupation?: string;
  address?: string;
  wards?: InitialWardLink[];
}

export interface UpdateGuardianRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  occupation?: string;
  address?: string;
  communicationEmailsEnabled: boolean;
}

export type GuardianAccountOutcome = "CREATED" | "ATTACHED";

/**
 * `outcome === "CREATED"`: a brand-new account, `temporaryPassword` is a
 * server-generated password returned exactly once. `outcome === "ATTACHED"`:
 * this email already had a KDLMS account (e.g. at another school) - the
 * existing account was reused as-is, `temporaryPassword` is null, and the
 * `guardian` fields reflect the EXISTING account, not the request's typed
 * values (CLAUDE.md's cross-school guardian rule).
 */
export interface GuardianCreateResult {
  guardian: GuardianView;
  temporaryPassword: string | null;
  outcome: GuardianAccountOutcome;
}

/** Mirrors backend student.application.port.in.WardView. */
export interface WardView {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  relationship: string;
}

const BASE = "/api/v1/guardians";

export function createGuardian(request: CreateGuardianRequest): Promise<GuardianCreateResult> {
  return apiFetch<GuardianCreateResult>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function getGuardian(guardianId: string): Promise<GuardianView> {
  return apiFetch<GuardianView>(`${BASE}/${guardianId}`);
}

export function listGuardians(q = "", page = 0, size = 20): Promise<Page<GuardianView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  return apiFetch<Page<GuardianView>>(`${BASE}?${params.toString()}`);
}

export function updateGuardian(guardianId: string, request: UpdateGuardianRequest): Promise<GuardianView> {
  return apiFetch<GuardianView>(`${BASE}/${guardianId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function enableGuardian(guardianId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${guardianId}/enable`, { method: "PATCH" });
}

export function disableGuardian(guardianId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${guardianId}/disable`, { method: "PATCH" });
}

export function listGuardianWards(guardianId: string): Promise<WardView[]> {
  return apiFetch<WardView[]>(`${BASE}/${guardianId}/students`);
}

export function linkGuardianToStudent(guardianId: string, studentId: string, relationship: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${guardianId}/students`, {
    method: "POST",
    body: JSON.stringify({ studentId, relationship }),
  });
}

export function unlinkGuardianFromStudent(guardianId: string, studentId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${guardianId}/students/${studentId}`, { method: "DELETE" });
}
