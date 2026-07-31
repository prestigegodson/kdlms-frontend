import { apiFetch } from "@/api/client";

export type AssessmentMode = "NUMERIC" | "QUALITATIVE";

/** Mirrors backend assessment.application.port.in.GradingSystemView.GradeBoundaryView. */
export interface GradeBoundary {
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
}

/** Mirrors backend assessment.application.port.in.GradingSystemView.RatingOptionView. */
export interface RatingOption {
  id: string;
  label: string;
  description?: string;
  rank: number;
}

/**
 * Mirrors backend assessment.application.port.in.GradingSystemView. Either a
 * school's saved grading system (`configured: true`) or a preview of the
 * base-level default for a level that hasn't been explicitly configured yet.
 */
export interface GradingSystemView {
  levelId: string;
  levelName: string;
  baseLevel: string;
  name: string;
  assessmentMode: AssessmentMode;
  quizWeight?: number;
  examWeight?: number;
  quizMax?: number;
  examMax?: number;
  boundaries: GradeBoundary[];
  ratingOptions: RatingOption[];
  configured: boolean;
}

export interface SaveNumericGradingSystemRequest {
  name: string;
  quizWeight: number;
  examWeight: number;
  quizMax: number;
  examMax: number;
  boundaries: GradeBoundary[];
}

export interface SaveQualitativeGradingSystemRequest {
  name: string;
  ratingOptions: Array<{ label: string; description?: string; rank: number }>;
}

const BASE = "/api/v1/grading-systems";

/** Every active level of the school, rank order, each with its current or previewed grading configuration. */
export function listGradingSystems(): Promise<GradingSystemView[]> {
  return apiFetch<GradingSystemView[]>(BASE);
}

export function getGradingSystem(levelId: string): Promise<GradingSystemView> {
  return apiFetch<GradingSystemView>(`${BASE}/${levelId}`);
}

export function saveNumericGradingSystem(
  levelId: string,
  request: SaveNumericGradingSystemRequest,
): Promise<GradingSystemView> {
  return apiFetch<GradingSystemView>(`${BASE}/${levelId}/numeric`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function saveQualitativeGradingSystem(
  levelId: string,
  request: SaveQualitativeGradingSystemRequest,
): Promise<GradingSystemView> {
  return apiFetch<GradingSystemView>(`${BASE}/${levelId}/qualitative`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}
