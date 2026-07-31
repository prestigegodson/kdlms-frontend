import { apiFetch } from "@/api/client";

export type LevelStatus = "ACTIVE" | "INACTIVE";

/**
 * Mirrors backend academics.application.port.in.LevelView. `baseLevel` is
 * the immutable stage category (PRE_SCHOOL..SECONDARY) a level was created
 * against - never rendered directly, only used to label the stage a
 * school-renamed level started from. `displayName`/`rank`/`status` are the
 * school-editable parts. The three counts drive delete-gating and usage
 * copy in the UI.
 */
export interface LevelView {
  id: string;
  baseLevel: string;
  displayName: string;
  rank: number;
  status: LevelStatus;
  subjectCount: number;
  classCount: number;
  subjectGroupCount: number;
}

export interface CreateLevelRequest {
  baseLevel: string;
  displayName: string;
}

export interface RenameLevelRequest {
  displayName: string;
}

export interface ReorderLevelsRequest {
  levelIds: string[];
}

const BASE = "/api/v1/levels";

/** Ordered by rank - the caller's own school. Every school-portal role may read this. */
export function listLevels(): Promise<LevelView[]> {
  return apiFetch<LevelView[]>(BASE);
}

/** SCHOOL_ADMIN only. */
export function createLevel(request: CreateLevelRequest): Promise<LevelView> {
  return apiFetch<LevelView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function renameLevel(levelId: string, request: RenameLevelRequest): Promise<LevelView> {
  return apiFetch<LevelView>(`${BASE}/${levelId}`, { method: "PUT", body: JSON.stringify(request) });
}

/** Rewrites every level's rank to its position in the given list, which must be the school's full level id set. */
export function reorderLevels(request: ReorderLevelsRequest): Promise<LevelView[]> {
  return apiFetch<LevelView[]>(`${BASE}/order`, { method: "PUT", body: JSON.stringify(request) });
}

export function activateLevel(levelId: string): Promise<LevelView> {
  return apiFetch<LevelView>(`${BASE}/${levelId}/activate`, { method: "PATCH" });
}

export function deactivateLevel(levelId: string): Promise<LevelView> {
  return apiFetch<LevelView>(`${BASE}/${levelId}/deactivate`, { method: "PATCH" });
}

/** Rejected server-side (422) while any subject, class, or subject group still references the level. */
export function deleteLevel(levelId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${levelId}`, { method: "DELETE" });
}
