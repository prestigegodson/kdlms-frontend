import { apiFetch } from "@/api/client";

export type PeriodKind = "TEACHING" | "BREAK";

/** Mirrors backend timetable.application.port.in.LevelPeriodGridView.PeriodView. */
export interface PeriodView {
  id: string;
  position: number;
  label: string;
  startTime: string;
  endTime: string;
  kind: PeriodKind;
  /** Whether any timetable entry (Phase 12C) references this period - a delete or TEACHING-to-BREAK flip is refused server-side while true. */
  inUse: boolean;
}

/** Mirrors backend timetable.application.port.in.LevelPeriodGridView. */
export interface LevelPeriodGridView {
  levelId: string;
  levelName: string;
  periods: PeriodView[];
}

/** Mirrors backend timetable.application.port.in.ManagePeriodGridUseCase.PeriodCommand - a null id means "new period". */
export interface PeriodCommand {
  id: string | null;
  label: string;
  startTime: string;
  endTime: string;
  kind: PeriodKind;
}

export interface SavePeriodGridRequest {
  periods: PeriodCommand[];
}

const BASE = "/api/v1/timetable";

/** Every active level of the school, rank order, each with its current grid. */
export function listPeriodGrids(): Promise<LevelPeriodGridView[]> {
  return apiFetch<LevelPeriodGridView[]>(`${BASE}/periods`);
}

export function getPeriodGrid(levelId: string): Promise<LevelPeriodGridView> {
  return apiFetch<LevelPeriodGridView>(`${BASE}/periods/${levelId}`);
}

/** Full replace, ids preserved - see ManagePeriodGridUseCase's Javadoc for the edit-locking rules this enforces server-side. */
export function savePeriodGrid(levelId: string, request: SavePeriodGridRequest): Promise<LevelPeriodGridView> {
  return apiFetch<LevelPeriodGridView>(`${BASE}/periods/${levelId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
