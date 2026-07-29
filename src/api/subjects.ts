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
  status: SubjectStatus;
}

export interface CreateSubjectRequest {
  levelId: string;
  name: string;
  code?: string;
}

export interface UpdateSubjectRequest {
  name: string;
  code?: string;
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
