import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";
import type { SupportedCurrency } from "@/utils/currency";

export { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/utils/currency";

/** Mirrors backend creator.adapter.in.web.CreatorProfileRequest - the business-profile fields every creator form shares. */
export interface CreatorProfileInput {
  firstName: string;
  lastName: string;
  businessName: string;
  contactAddress: string;
  mobile: string;
  /** IANA zone id, e.g. "Africa/Lagos". */
  timezone: string;
  currency: SupportedCurrency;
}

/** Mirrors backend creator.application.port.in.CreatorProfileView. */
export interface CreatorProfile extends CreatorProfileInput {
  schoolId: string;
}

/** Mirrors backend creator.application.port.in.CreatorAdminView. */
export interface CreatorAdminView extends CreatorProfileInput {
  schoolId: string;
  /** The creator tenant's lifecycle status - ACTIVE, SUSPENDED, ARCHIVED (or UNKNOWN). */
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "UNKNOWN";
  userId: string | null;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface RegisterCreatorRequest {
  email: string;
  password: string;
  profile: CreatorProfileInput;
}

export interface RegistrationResponse {
  schoolId: string;
  userId: string;
}

/** Public creator self-registration - the new creator then signs in through the ordinary login. */
export function registerCreator(request: RegisterCreatorRequest): Promise<RegistrationResponse> {
  return apiFetch<RegistrationResponse>("/api/v1/public/creators/register", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify(request),
  });
}

export function getMyCreatorProfile(): Promise<CreatorProfile> {
  return apiFetch<CreatorProfile>("/api/v1/creator/profile");
}

export function updateMyCreatorProfile(profile: CreatorProfileInput): Promise<CreatorProfile> {
  return apiFetch<CreatorProfile>("/api/v1/creator/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

const ADMIN_BASE = "/api/v1/admin/creators";

export function listCreators(query: string, page = 0, size = 20): Promise<Page<CreatorAdminView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) {
    params.set("q", query.trim());
  }
  return apiFetch<Page<CreatorAdminView>>(`${ADMIN_BASE}?${params.toString()}`);
}

export function getCreator(schoolId: string): Promise<CreatorAdminView> {
  return apiFetch<CreatorAdminView>(`${ADMIN_BASE}/${schoolId}`);
}

export interface OnboardCreatorResult {
  creator: CreatorAdminView;
  /** Shown to the system admin exactly once; also emailed to the creator. */
  temporaryPassword: string;
}

export function onboardCreator(email: string, profile: CreatorProfileInput): Promise<OnboardCreatorResult> {
  return apiFetch<OnboardCreatorResult>(ADMIN_BASE, {
    method: "POST",
    body: JSON.stringify({ email, profile }),
  });
}
