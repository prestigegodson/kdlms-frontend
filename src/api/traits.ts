import { apiFetch } from "@/api/client";

/** Mirrors backend assessment.application.port.in.TraitConfigurationView.ScaleOptionView. */
export interface TraitScaleOption {
  id: string;
  value: string;
  label: string;
  description?: string;
  rank: number;
}

/** Mirrors backend assessment.application.port.in.TraitConfigurationView.TraitView. */
export interface TraitDefinition {
  id: string;
  name: string;
  rank: number;
  active: boolean;
}

/** Mirrors backend assessment.application.port.in.TraitConfigurationView.CategoryView. */
export interface TraitCategoryView {
  scaleOptions: TraitScaleOption[];
  traits: TraitDefinition[];
}

/**
 * Mirrors backend assessment.application.port.in.TraitConfigurationView - a
 * level's behavioural-trait configuration. `configured` distinguishes a
 * school's saved configuration from the platform default preview, matching
 * `GradingSystemView`'s own contract.
 */
export interface TraitConfigurationView {
  levelId: string;
  levelName: string;
  affectiveEnabled: boolean;
  psychomotorEnabled: boolean;
  affective: TraitCategoryView;
  psychomotor: TraitCategoryView;
  configured: boolean;
}

export interface SaveScaleOptionRequest {
  /** `undefined`/omitted means a freshly authored option; an existing id updates that row in place. `rank` is derived server-side from list position. */
  id?: string;
  value: string;
  label: string;
  description?: string;
}

export interface SaveTraitRequest {
  /** `undefined`/omitted means a freshly authored trait; an existing id updates that row in place. */
  id?: string;
  name: string;
  active: boolean;
}

export interface SaveCategoryRequest {
  enabled: boolean;
  scaleOptions: SaveScaleOptionRequest[];
  traits: SaveTraitRequest[];
}

export interface SaveTraitConfigurationRequest {
  affective: SaveCategoryRequest;
  psychomotor: SaveCategoryRequest;
}

export function getTraitConfiguration(levelId: string): Promise<TraitConfigurationView> {
  return apiFetch<TraitConfigurationView>(`/api/v1/levels/${levelId}/traits`);
}

export function saveTraitConfiguration(
  levelId: string,
  request: SaveTraitConfigurationRequest,
): Promise<TraitConfigurationView> {
  return apiFetch<TraitConfigurationView>(`/api/v1/levels/${levelId}/traits`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
