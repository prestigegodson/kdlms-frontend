import { apiFetch } from "@/api/client";

/** Mirrors backend academics.application.port.in.LevelView. */
export interface LevelView {
  id: string;
  name: string;
  displayName: string;
  rank: number;
}

const BASE = "/api/v1/levels";

/** System-seeded reference data - five rows, no pagination. */
export function listLevels(): Promise<LevelView[]> {
  return apiFetch<LevelView[]>(BASE);
}
