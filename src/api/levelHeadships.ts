import { apiFetch } from "@/api/client";

/** Mirrors backend academics.application.port.in.ManageLevelHeadshipsUseCase.LevelHeadshipView. */
export interface LevelHeadshipView {
  levelId: string;
  levelName: string;
}

/** The levels a TEACHER heads in their own branch (Head of Level) - SCHOOL_ADMIN only. */
export function listLevelHeadships(teacherId: string): Promise<LevelHeadshipView[]> {
  return apiFetch<LevelHeadshipView[]>(`/api/v1/teachers/${teacherId}/level-headships`);
}

/** Full replace of a teacher's headed levels; an empty list revokes every headship. SCHOOL_ADMIN only. */
export function replaceLevelHeadships(
  teacherId: string,
  levelIds: string[],
): Promise<LevelHeadshipView[]> {
  return apiFetch<LevelHeadshipView[]>(`/api/v1/teachers/${teacherId}/level-headships`, {
    method: "PUT",
    body: JSON.stringify({ levelIds }),
  });
}

/** Mirrors backend academics.application.port.in.ManageLevelHeadshipsUseCase.SchoolLevelHeadshipView. */
export interface SchoolLevelHeadshipView {
  teacherId: string;
  teacherName: string;
  branchId: string;
  levelId: string;
  levelName: string;
  /** False for an archived level - the headship is kept but grants nothing until the level is restored. */
  levelActive: boolean;
}

/**
 * Every Head of Level in the school with the level they head, one row per (teacher, level), in level
 * order - SCHOOL_ADMIN only. Omit branchId to span every branch.
 */
export function listSchoolLevelHeadships(branchId?: string): Promise<SchoolLevelHeadshipView[]> {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return apiFetch<SchoolLevelHeadshipView[]>(`/api/v1/level-headships${query}`);
}
