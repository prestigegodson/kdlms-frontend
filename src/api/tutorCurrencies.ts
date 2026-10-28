import { apiFetch } from "@/api/client";
import type { SupportedCurrency } from "@/utils/currency";

/** Mirrors backend platform.application.port.in.ManageTutorCurrenciesUseCase.TutorCurrenciesView. */
export interface TutorCurrenciesView {
  /** In SUPPORTED_CURRENCIES order; never empty. */
  enabled: SupportedCurrency[];
  /** Always one of `enabled`. */
  defaultCurrency: SupportedCurrency;
  /** Every currency the platform can price in, for the admin's checkboxes. */
  supported: SupportedCurrency[];
}

/** Mirrors backend platform.adapter.in.web.PublicTutorCurrenciesController.PublicTutorCurrenciesView. */
export type PublicTutorCurrencies = Pick<TutorCurrenciesView, "enabled" | "defaultCurrency">;

/** A full replace. */
export interface SaveTutorCurrenciesRequest {
  enabled: SupportedCurrency[];
  defaultCurrency: SupportedCurrency;
}

const ADMIN_BASE = "/api/v1/admin/tutor-currencies";

/** SYSTEM_ADMIN read - GET /api/v1/admin/tutor-currencies. */
export function getTutorCurrencies(): Promise<TutorCurrenciesView> {
  return apiFetch<TutorCurrenciesView>(ADMIN_BASE);
}

/** SYSTEM_ADMIN write - PUT /api/v1/admin/tutor-currencies. */
export function updateTutorCurrencies(
  request: SaveTutorCurrenciesRequest,
): Promise<TutorCurrenciesView> {
  return apiFetch<TutorCurrenciesView>(ADMIN_BASE, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/** Public read - the tutor sign-up page has no session yet; signed-in tutors use it too. */
export function getPublicTutorCurrencies(): Promise<PublicTutorCurrencies> {
  return apiFetch<PublicTutorCurrencies>("/api/v1/public/tutor-currencies", {
    authenticated: false,
  });
}
