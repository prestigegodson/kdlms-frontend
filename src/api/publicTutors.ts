import { ApiError, apiFetch, apiUrl } from "@/api/client";
import type { PublicContactLink } from "@/api/creators";

/** Mirrors backend creator.application.port.in.PublicTutorProfileUseCase.PublicTutorProfileView. */
export interface PublicTutorProfile {
  handle: string;
  businessName: string;
  tutorName: string;
  bio: string | null;
  /** Changes whenever the logo does - the image URL's cache key; null when there's no logo. */
  logoVersion: string | null;
  bannerVersion: string | null;
  links: PublicContactLink[];
  joinRequestsEnabled: boolean;
}

/** Mirrors backend PublicTutorProfileController.JoinRequestRequest. */
export interface JoinRequestInput {
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  /** The honeypot - a field people never see, so only a bot fills it in. */
  website: string;
  /** The Turnstile widget's token - required only while the backend serves a `captchaSiteKey`. */
  captchaToken: string | null;
}

const BASE = "/api/v1/public/tutors";

/** A tutor's published page, or `null` when there is none (unpublished and unknown look the same). */
export async function getPublicTutor(handle: string): Promise<PublicTutorProfile | null> {
  try {
    return await apiFetch<PublicTutorProfile>(`${BASE}/${encodeURIComponent(handle)}`, {
      authenticated: false,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** An absolute `<img src>` for the page's logo or banner - public, so no blob fetch is needed. */
export function publicTutorImageUrl(
  handle: string,
  kind: "logo" | "banner",
  version: string,
): string {
  return apiUrl(`${BASE}/${encodeURIComponent(handle)}/${kind}?v=${encodeURIComponent(version)}`);
}

export function submitJoinRequest(handle: string, input: JoinRequestInput): Promise<void> {
  return apiFetch<void>(`${BASE}/${encodeURIComponent(handle)}/join-requests`, {
    method: "POST",
    authenticated: false,
    body: JSON.stringify(input),
  });
}
