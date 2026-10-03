import { ADMIN_TOURS } from "@/features/onboarding/tours/admin";
import { GUARDIAN_TOURS } from "@/features/onboarding/tours/guardian";
import { SCHOOL_TOURS } from "@/features/onboarding/tours/school";
import { SHELL_TOURS } from "@/features/onboarding/tours/shell";
import { STUDENT_TOURS } from "@/features/onboarding/tours/student";
import type { Portal, TourDefinition } from "@/features/onboarding/types";

/** Every onboarding guide. Keys are persisted server-side - never rename one; bump `version` instead. */
export const TOURS: TourDefinition[] = [
  ...SHELL_TOURS,
  ...SCHOOL_TOURS,
  ...GUARDIAN_TOURS,
  ...STUDENT_TOURS,
  ...ADMIN_TOURS,
];

/** Mirrors backend identity.domain.TourKey's shape. */
export const TOUR_KEY_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;

export function findTour(key: string): TourDefinition | undefined {
  return TOURS.find((tour) => tour.key === key);
}

export function shellTourFor(portal: Portal): TourDefinition | undefined {
  return TOURS.find((tour) => tour.portal === portal && tour.kind === "shell");
}
