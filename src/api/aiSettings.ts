import { apiFetch } from "@/api/client";

/** Mirrors backend platform.application.port.in.ManageAiSettingsUseCase.AiSettingsView. */
export interface AiSettingsView {
  provider: string | null;
  model: string | null;
  maxTokens: number | null;
  temperature: number | null;
  effectiveProvider: string;
  effectiveModel: string | null;
  effectiveMaxTokens: number;
  /** Null when a saved row exists with its temperature explicitly cleared - see backend AiConfiguration.AiSettings' javadoc. */
  effectiveTemperature: number | null;
  availableProviders: string[];
}

/** A full replace, like the rest of this codebase's settings resources - omitting a field clears it. */
export interface SaveAiSettingsRequest {
  provider: string | null;
  model: string | null;
  maxTokens: number | null;
  temperature: number | null;
}

/** Mirrors backend lessonnote.application.port.in.ViewAiUsageUseCase.SchoolUsageView. */
export interface SchoolUsageView {
  schoolId: string;
  schoolName: string;
  totalGenerations: number;
  succeeded: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
}

const SETTINGS_BASE = "/api/v1/admin/ai-settings";
const USAGE_BASE = "/api/v1/admin/ai-usage";

/** SYSTEM_ADMIN read - GET /api/v1/admin/ai-settings. */
export function getAiSettings(): Promise<AiSettingsView> {
  return apiFetch<AiSettingsView>(SETTINGS_BASE);
}

/** SYSTEM_ADMIN write - PUT /api/v1/admin/ai-settings. */
export function updateAiSettings(request: SaveAiSettingsRequest): Promise<AiSettingsView> {
  return apiFetch<AiSettingsView>(SETTINGS_BASE, { method: "PUT", body: JSON.stringify(request) });
}

/** SYSTEM_ADMIN read - GET /api/v1/admin/ai-usage. Current calendar month only. */
export function getAiUsage(): Promise<SchoolUsageView[]> {
  return apiFetch<SchoolUsageView[]>(USAGE_BASE);
}
