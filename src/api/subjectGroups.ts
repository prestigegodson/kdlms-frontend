import { apiFetch } from "@/api/client";

/** Mirrors backend academics.application.port.in.SubjectGroupView. */
export interface SubjectGroupView {
  id: string;
  schoolId: string;
  levelId: string;
  name: string;
}

export interface CreateSubjectGroupRequest {
  levelId: string;
  name: string;
}

export interface RenameSubjectGroupRequest {
  name: string;
}

const BASE = "/api/v1/subject-groups";

/** {@code levelId} narrows to one level; omit to list every group of the caller's school. Alphabetical. */
export function listSubjectGroups(levelId?: string): Promise<SubjectGroupView[]> {
  const params = levelId ? `?levelId=${levelId}` : "";
  return apiFetch<SubjectGroupView[]>(`${BASE}${params}`);
}

export function createSubjectGroup(request: CreateSubjectGroupRequest): Promise<SubjectGroupView> {
  return apiFetch<SubjectGroupView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function renameSubjectGroup(
  subjectGroupId: string,
  request: RenameSubjectGroupRequest,
): Promise<SubjectGroupView> {
  return apiFetch<SubjectGroupView>(`${BASE}/${subjectGroupId}`, { method: "PUT", body: JSON.stringify(request) });
}

export function deleteSubjectGroup(subjectGroupId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${subjectGroupId}`, { method: "DELETE" });
}
