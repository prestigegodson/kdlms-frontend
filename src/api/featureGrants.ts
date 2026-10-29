import { apiFetch } from "@/api/client";

/** Mirrors backend shared.domain.SubscriptionFeature, minus MULTI_BRANCH (a branch limit, never grantable). */
export type GrantableFeature =
  | "TAKE_HOME_QUIZ"
  | "ON_DEMAND_LEARNING"
  | "COMMUNICATION"
  | "TIMETABLE"
  | "LESSON_NOTES"
  | "AI_LESSON_NOTES"
  | "BILLING"
  | "LEARNING_MEDIA"
  | "STUDENT_LOGINS"
  | "GUARDIAN_ACCESS"
  | "INTERACTIVE_QUESTIONS"
  | "INTERACTIVE_VIDEO"
  | "PLATFORM_VIDEO"
  | "STAFF_ATTENDANCE";

/**
 * Mirrors backend subscription.application.port.in.FeatureGrantView - one feature a system admin
 * turned on for a single tenant on top of its package. Only counts while the tenant has an
 * active subscription. `aiGenerationLimit` is set on AI_LESSON_NOTES only.
 */
export interface FeatureGrantView {
  feature: GrantableFeature;
  aiGenerationLimit: number | null;
  grantedAt: string;
}

function adminBase(schoolId: string): string {
  return `/api/v1/admin/schools/${schoolId}/feature-grants`;
}

export function listFeatureGrants(schoolId: string): Promise<FeatureGrantView[]> {
  return apiFetch<FeatureGrantView[]>(adminBase(schoolId));
}

/** Grants the feature, or updates an existing AI_LESSON_NOTES grant's limit. */
export function saveFeatureGrant(
  schoolId: string,
  feature: GrantableFeature,
  aiGenerationLimit?: number,
): Promise<FeatureGrantView> {
  return apiFetch<FeatureGrantView>(`${adminBase(schoolId)}/${feature}`, {
    method: "PUT",
    body: JSON.stringify({ aiGenerationLimit: aiGenerationLimit ?? null }),
  });
}

export function removeFeatureGrant(schoolId: string, feature: GrantableFeature): Promise<void> {
  return apiFetch<void>(`${adminBase(schoolId)}/${feature}`, { method: "DELETE" });
}
