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
  assessmentMode: AssessmentMode;
  quizWeight?: number;
  examWeight?: number;
  quizMax?: number;
  examMax?: number;
  /** Whether class position is shown on the rendered report and the guardian portal. Always true for QUALITATIVE. */
  showPosition: boolean;
  /**
   * Whether a mid-term result carries a grade letter. Unlike `showPosition`
   * (a report/guardian-only display toggle - staff always see position on
   * the broadsheet regardless), this one applies to every audience
   * including staff: its intent is "this school doesn't grade mid-terms at
   * all", not "hide it from parents only". Always true for QUALITATIVE.
   */
  showMidtermGrade: boolean;
  boundaries: GradeBoundary[];
  ratingOptions: RatingOption[];
  configured: boolean;
}

export interface SaveNumericGradingSystemRequest {
  quizWeight: number;
  examWeight: number;
  quizMax: number;
  examMax: number;
  showPosition: boolean;
  showMidtermGrade: boolean;
  boundaries: GradeBoundary[];
}

export interface SaveQualitativeGradingSystemRequest {
  /** `id`: omit/undefined for a freshly authored option, or an existing option's id to edit it in place - see `RatingOption`'s Javadoc. */
  ratingOptions: Array<{ id?: string; label: string; description?: string; rank: number }>;
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
