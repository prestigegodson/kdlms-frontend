import { apiFetch } from "@/api/client";

/**
 * Mirrors backend subscription.application.port.in.MyFeaturesView - the
 * caller's own school's gated feature flags, readable by every school-scoped
 * role including GUARDIAN (unlike `api/subscriptions.ts`'s summary, which is
 * SCHOOL_ADMIN/BRANCH_ADMIN/TEACHER only) so both portals' navs can hide an
 * unentitled feature.
 */
export interface MyFeaturesView {
  communication: boolean;
  timetable: boolean;
}

export function getMyFeatures(): Promise<MyFeaturesView> {
  return apiFetch<MyFeaturesView>("/api/v1/me/features");
}
