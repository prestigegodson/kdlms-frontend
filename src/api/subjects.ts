import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type SubjectStatus = "ACTIVE" | "INACTIVE";

/** Mirrors backend academics.application.port.in.SubjectView. */
export interface SubjectView {
  id: string;
  schoolId: string;
  levelId: string;
  name: string;
  code?: string;
  subjectGroupId?: string;
  subjectGroupName?: string;
  /** Which of terms 1-3 this subject is taught in, ascending - e.g. [1, 2, 3] or [3]. */
  termNumbers: number[];
  status: SubjectStatus;
}

export interface CreateSubjectRequest {
  levelId: string;
  name: string;
  code?: string;
  /** Optional; when set, must be a subject group of this same level. */
  subjectGroupId?: string;
  /** Optional; omit or leave empty to default to every term. */
  termNumbers?: number[];
}

export interface UpdateSubjectRequest {
  name: string;
  code?: string;
  /** Optional; when set, must be a subject group of the subject's level. */
  subjectGroupId?: string;
  /**
   * Optional; omit or leave empty to default to every term. Narrowing away a
   * term with recorded assessments is rejected by the backend.
   */
  termNumbers?: number[];
}

const BASE = "/api/v1/subjects";

/** {@code levelId} narrows to one level; omit to list every subject of the caller's school. */
export function listSubjects(levelId?: string, page = 0, size = 50): Promise<Page<SubjectView>> {
  const levelParam = levelId ? `&levelId=${levelId}` : "";
  return apiFetch<Page<SubjectView>>(`${BASE}?page=${page}&size=${size}${levelParam}`);
}

export function createSubject(request: CreateSubjectRequest): Promise<SubjectView> {
  return apiFetch<SubjectView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateSubject(subjectId: string, request: UpdateSubjectRequest): Promise<SubjectView> {
  return apiFetch<SubjectView>(`${BASE}/${subjectId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function activateSubject(subjectId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${subjectId}/activate`, { method: "PATCH" });
}

export function deactivateSubject(subjectId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${subjectId}/deactivate`, { method: "PATCH" });
}

/** Rejected server-side (422) once any score or rating has been recorded for the subject. */
export function deleteSubject(subjectId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${subjectId}`, { method: "DELETE" });
}
