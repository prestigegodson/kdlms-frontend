import { apiFetch } from "@/api/client";

/** Mirrors backend filestorage.domain.StorageClass - warmest first. */
export type StorageClass = "STANDARD" | "STANDARD_IA" | "GLACIER_IR";

export const STORAGE_CLASSES: StorageClass[] = ["STANDARD", "STANDARD_IA", "GLACIER_IR"];

/** Mirrors backend filestorage.domain.TieringTally. */
export interface TieringTally {
  scanned: number;
  toStandard: number;
  toStandardIa: number;
  toGlacierIr: number;
  skipped: number;
  failed: number;
}

/** Mirrors backend filestorage.domain.StorageTieringRun. */
export interface StorageTieringRun {
  id: string;
  trigger: "SCHEDULED" | "MANUAL";
  triggeredBy: string | null;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  tally: TieringTally;
  error: string | null;
}

/** Mirrors backend ViewStorageUseCase.ClassShare. Percentages are 0-100. */
export interface ClassShare {
  storageClass: StorageClass;
  files: number;
  bytes: number;
  filePercent: number;
  bytePercent: number;
  estimatedMonthlyCost: number;
}

/** Mirrors backend ViewStorageUseCase.StorageOverview. Costs are USD per month. */
export interface StorageOverview {
  totalFiles: number;
  totalBytes: number;
  byClass: ClassShare[];
  estimatedMonthlyCost: number;
  estimatedMonthlyCostIfAllStandard: number;
  tieringEnabled: boolean;
  activeRun: StorageTieringRun | null;
  lastRun: StorageTieringRun | null;
}

/** Mirrors backend ViewStorageUseCase.SchoolStorage. A null schoolId is the platform's own system assets. */
export interface SchoolStorage {
  schoolId: string | null;
  schoolName: string | null;
  files: number;
  bytes: number;
  byClass: Partial<Record<StorageClass, { files: number; bytes: number }>>;
}

const BASE = "/api/v1/admin/storage";

/** SYSTEM_ADMIN read - GET /api/v1/admin/storage. */
export function getStorageOverview(): Promise<StorageOverview> {
  return apiFetch<StorageOverview>(BASE);
}

/** SYSTEM_ADMIN read - GET /api/v1/admin/storage/schools, largest first. */
export function getStorageBySchool(): Promise<SchoolStorage[]> {
  return apiFetch<SchoolStorage[]>(`${BASE}/schools`);
}

/** SYSTEM_ADMIN read - GET /api/v1/admin/storage/runs, newest first. */
export function getTieringRuns(limit = 10): Promise<StorageTieringRun[]> {
  return apiFetch<StorageTieringRun[]>(`${BASE}/runs?limit=${limit}`);
}

/** SYSTEM_ADMIN write - POST /api/v1/admin/storage/runs. 409 when tiering is off or a run is already active. */
export function startTieringRun(): Promise<StorageTieringRun> {
  return apiFetch<StorageTieringRun>(`${BASE}/runs`, { method: "POST" });
}
