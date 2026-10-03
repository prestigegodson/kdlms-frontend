import { apiFetch } from "@/api/client";

/** Mirrors backend identity.domain.TourStatus. */
export type TourStatus = "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

/** Mirrors backend identity.application.port.in.ManageOnboardingUseCase.TourProgressView. */
export interface TourProgressView {
  key: string;
  version: number;
  status: TourStatus;
  stepIndex: number;
  updatedAt: string;
}

/** Mirrors backend ManageOnboardingUseCase.OnboardingView - the caller's own guide progress. */
export interface OnboardingView {
  autoStart: boolean;
  tours: TourProgressView[];
}

export interface SaveTourProgressRequest {
  version: number;
  status: TourStatus;
  stepIndex: number;
}

const BASE = "/api/v1/me/onboarding";

export function getMyOnboarding(): Promise<OnboardingView> {
  return apiFetch<OnboardingView>(BASE);
}

export function saveTourProgress(key: string, request: SaveTourProgressRequest): Promise<void> {
  return apiFetch<void>(`${BASE}/tours/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function updateOnboardingPreferences(autoStart: boolean): Promise<void> {
  return apiFetch<void>(`${BASE}/preferences`, { method: "PUT", body: JSON.stringify({ autoStart }) });
}

export function resetAllTours(): Promise<void> {
  return apiFetch<void>(`${BASE}/tours`, { method: "DELETE" });
}
