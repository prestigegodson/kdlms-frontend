import { useNavigate } from "react-router";
import { type GuideStatus, isAvailable, statusFor, stepsFor } from "@/features/onboarding/eligibility";
import { TOURS } from "@/features/onboarding/tours/registry";
import type { Portal, TourDefinition } from "@/features/onboarding/types";
import { BELOW_LG_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuthStore } from "@/stores/authStore";
import { useOnboardingStore } from "@/stores/onboardingStore";

export interface GuideEntry {
  tour: TourDefinition;
  status: GuideStatus;
  /** Steps this caller will actually see - role-tailored and screen-size-specific steps excluded. */
  stepCount: number;
}

/** Every guide the caller can be offered in this portal, with its status - shell guide first. */
export function useGuides(portal: Portal | null): GuideEntry[] {
  const role = useAuthStore((state) => state.user?.role);
  const progress = useOnboardingStore((state) => state.progress);
  const visibleNavHrefs = useOnboardingStore((state) => state.visibleNavHrefs);
  const belowLg = useMediaQuery(BELOW_LG_QUERY);
  if (!portal || !role) {
    return [];
  }
  return TOURS.filter((tour) => isAvailable(tour, { portal, role, visibleNavHrefs }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "shell" ? -1 : 1))
    .map((tour) => ({
      tour,
      status: statusFor(tour, progress[tour.key]),
      stepCount: stepsFor(tour, role, belowLg).length,
    }));
}

/** Starts a guide by hand - going to its page first when it has one. Resumes a part-done guide. */
export function useStartGuide(): (tour: TourDefinition) => void {
  const navigate = useNavigate();
  const start = useOnboardingStore((state) => state.start);
  return (tour) => {
    const saved = useOnboardingStore.getState().progress[tour.key];
    const resume = saved && saved.status === "IN_PROGRESS" && saved.version === tour.version;
    if (tour.route) {
      navigate(tour.route);
    }
    start(tour.key, { manual: true, startIndex: resume ? saved.stepIndex : 0 });
  };
}
