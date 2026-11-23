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
  /** The business logo's file id; null when none is set. */
  logoFileId: string | null;
  /** The business banner's file id; null when none is set. */
  bannerFileId: string | null;
  /** The tutor's free-text bio, shown to their learners and guardians; null when none is set. */
  bio: string | null;
  /** The public page's link name - `/tutors/{publicHandle}`; null until chosen. */
  publicHandle: string | null;
  /** Whether the public page is published. */
  publicProfileEnabled: boolean;
  /** Whether the public page shows the "request to join" form. */
  joinRequestsEnabled: boolean;
  /** The public page's contact links, in display order. */
  publicLinks: PublicContactLink[];
  /** A link name derived from the business name, offered when none is chosen (may be taken). */
  suggestedHandle: string;
}

/** Mirrors backend creator.domain.PublicContactPlatform. */
export type PublicContactPlatform =
  | "EMAIL"
  | "PHONE"
  | "WHATSAPP"
  | "WEBSITE"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "X"
  | "LINKEDIN"
  | "YOUTUBE"
  | "TIKTOK";

/** In the order the editor offers them. */
export const PUBLIC_CONTACT_PLATFORMS: PublicContactPlatform[] = [
  "WHATSAPP",
  "PHONE",
  "EMAIL",
  "WEBSITE",
  "INSTAGRAM",
  "FACEBOOK",
  "X",
  "TIKTOK",
  "YOUTUBE",
  "LINKEDIN",
];

export const PUBLIC_CONTACT_PLATFORM_LABELS: Record<PublicContactPlatform, string> = {
  EMAIL: "Email",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  WEBSITE: "Website",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  X: "X (Twitter)",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
};

/** Mirrors backend creator.application.port.in.CreatorProfileView.PublicLinkView. */
export interface PublicContactLink {
  platform: PublicContactPlatform;
  value: string;
}

/** Mirrors backend MyCreatorProfileController.PublicProfileRequest. */
export interface PublicProfileInput {
  handle: string | null;
  enabled: boolean;
  joinRequestsEnabled: boolean;
  links: PublicContactLink[];
}

/** Mirrors backend MyCreatorProfileUseCase.HandleAvailability. */
export interface HandleAvailability {
  handle: string;
  available: boolean;
  /** Why it isn't available; null when it is. */
  reason: string | null;
}

/** Mirrors backend creator.domain.PublicHandle - 3-40 lowercase letters, digits or hyphens. */
export const PUBLIC_HANDLE_PATTERN = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;

/** Mirrors backend creator.domain.CreatorProfile.MAX_BIO_LENGTH. */
export const CREATOR_BIO_MAX_LENGTH = 2000;

/** The tutor's business images - ids of files already uploaded via `uploadFile`; null removes one. */
export interface CreatorBrandingInput {
  logoFileId: string | null;
  bannerFileId: string | null;
}

/** Mirrors backend creator.application.port.in.CreatorAdminView. */
export interface CreatorAdminView extends CreatorProfileInput {
  schoolId: string;
  /** The creator tenant's lifecycle status - ACTIVE, SUSPENDED, ARCHIVED (a deleted creator), or UNKNOWN. */
  status: "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "UNKNOWN";
  userId: string | null;
  email: string | null;
  emailVerified: boolean;
  /** The tutor's free-text bio; null when none is set. */
  bio: string | null;
  createdAt: string;
}

export interface RegisterCreatorRequest {
  email: string;
  password: string;
  profile: CreatorProfileInput;
  /** The Turnstile widget's token - required only while the backend serves a `captchaSiteKey`. */
  captchaToken?: string | null;
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

/** Sets (or removes) the tutor's business logo and banner - both fields every time. */
export function updateMyCreatorBranding(branding: CreatorBrandingInput): Promise<CreatorProfile> {
  return apiFetch<CreatorProfile>("/api/v1/creator/profile/branding", {
    method: "PUT",
    body: JSON.stringify(branding),
  });
}

/** Sets the tutor's bio - plain text; null or blank removes it. */
export function updateMyCreatorBio(bio: string | null): Promise<CreatorProfile> {
  return apiFetch<CreatorProfile>("/api/v1/creator/profile/bio", {
    method: "PUT",
    body: JSON.stringify({ bio }),
  });
}

/** Sets the public profile page - every field, every time. A link name another tutor holds is a 422. */
export function updateMyPublicProfile(input: PublicProfileInput): Promise<CreatorProfile> {
  return apiFetch<CreatorProfile>("/api/v1/creator/profile/public", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Live feedback for the link-name field - never an error for a bad name, just `available: false`. */
export function checkPublicHandle(handle: string): Promise<HandleAvailability> {
  return apiFetch<HandleAvailability>(
    `/api/v1/creator/profile/public/handle-availability?handle=${encodeURIComponent(handle)}`,
  );
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

/**
 * Deletes a creator - irreversible. The tenant is archived, the login soft-deleted, personal data
 * scrubbed, classes and renewals shut down; the email can register again.
 */
export function deleteCreator(schoolId: string): Promise<void> {
  return apiFetch<void>(`${ADMIN_BASE}/${schoolId}`, { method: "DELETE" });
}
