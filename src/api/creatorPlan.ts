import { apiFetch } from "@/api/client";
import type { BillingCycle } from "@/api/packages";

/**
 * Mirrors backend subscription.application.port.in.CreatorPlanView - the calling creator's own
 * effective plan. `source` is `SUBSCRIPTION` for a subscription active today (including the
 * auto-assigned Free one), `FREE_FALLBACK` when none is active and the Free plan applies, or
 * `NONE` when not even a Free plan exists. Each `max*` limit is `null` for unlimited.
 */
export interface CreatorPlanView {
  source: "SUBSCRIPTION" | "FREE_FALLBACK" | "NONE";
  packageId: string | null;
  planName: string | null;
  free: boolean;
  billingCycle: BillingCycle | null;
  startDate: string | null;
  /** `null` for the open-ended Free plan. */
  endDate: string | null;
  maxClasses: number | null;
  maxStudentsPerClass: number | null;
  maxSessionMinutes: number | null;
  maxParticipantsPerSession: number | null;
  maxMonthlySessionHours: number | null;
  lessonNotes: boolean;
  aiLessonNotes: boolean;
  aiGenerationLimit: number;
  takeHomeQuiz: boolean;
  onDemandLearning: boolean;
  learningMedia: boolean;
  communication: boolean;
  guardianAccess: boolean;
  /** A Paystack-paid plan renews itself from the saved card while this is on (Phase C8). */
  autoRenew: boolean;
  /** Set while a failed renewal is being retried - the plan stays active until this day. */
  graceUntil: string | null;
}

export function getMyCreatorPlan(): Promise<CreatorPlanView> {
  return apiFetch<CreatorPlanView>("/api/v1/creator/plan");
}
