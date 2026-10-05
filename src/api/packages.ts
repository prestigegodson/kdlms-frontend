import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";
import type { SupportedCurrency } from "@/utils/currency";

export type BillingCycle = "MONTHLY" | "ANNUAL";
export type PackageStatus = "ACTIVE" | "RETIRED";
/** Which tenant kind a package is sold to; fixed once the package exists. */
export type PackageAudience = "SCHOOL" | "CREATOR";

/** One of a package's prices, in the currency's minor unit (kobo for NGN). Mirrors backend PriceView. */
export interface PackagePrice {
  currency: SupportedCurrency;
  amountMinor: number;
}

/**
 * The five CREATOR-plan limits (creators.md §5); `null` means unlimited. Always `null` on a
 * SCHOOL package.
 */
export interface CreatorPlanLimitFields {
  maxClasses: number | null;
  maxStudentsPerClass: number | null;
  maxSessionMinutes: number | null;
  maxParticipantsPerSession: number | null;
  maxMonthlySessionHours: number | null;
}

/** Mirrors backend subscription.application.port.in.PackageView. */
export interface PackageView extends CreatorPlanLimitFields {
  id: string;
  name: string;
  description?: string;
  billingCycle: BillingCycle;
  audience: PackageAudience;
  /** The platform's Free creator plan - no prices, never expires. At most one is ACTIVE. */
  free: boolean;
  /** Empty only for the free plan; at most one per currency. */
  prices: PackagePrice[];
  multiBranch: boolean;
  branchLimit: number;
  /** SCHOOL packages only; `null` on a CREATOR plan. */
  activeStudentLimit: number | null;
  /** Also actually gates the feature (Phase 20), the same hard-lockout shape `communication`/`timetable`/`lessonNotes` use - see CLAUDE.md. */
  takeHomeQuiz: boolean;
  /** Live once the `learning` module ships (Phase 35E) - the same hard-lockout shape as the other gating flags. */
  onDemandLearning: boolean;
  /** Also actually gates the feature, the same hard-lockout shape `takeHomeQuiz` uses - see CLAUDE.md. */
  communication: boolean;
  /** Also actually gates the feature, the same hard-lockout shape `communication` uses - see CLAUDE.md. */
  timetable: boolean;
  /** Also actually gates the feature, the same hard-lockout shape `communication`/`timetable` use - see CLAUDE.md. */
  lessonNotes: boolean;
  /**
   * A second, independent gate layered on top of lessonNotes for the AI-generation button only -
   * a school can have the lesson-notes module without the AI add-on. Paired with aiGenerationLimit.
   */
  aiLessonNotes: boolean;
  /** Per-school AI lesson-note generations allowed per calendar month. 0 = none (also the effective value whenever aiLessonNotes is false). */
  aiGenerationLimit: number;
  /** Also actually gates the feature, the same hard-lockout shape `communication`/`timetable`/`lessonNotes` use - see CLAUDE.md. Never confuse with the SaaS operator's own billing of the school (this package's own `price`/`billingCycle`). */
  billing: boolean;
  /** A second, independent gate layered on top of onDemandLearning for uploaded mp3/mp4 resources only - live once Phase 35F ships. */
  learningMedia: boolean;
  /** Entitlement for the student portal and credential provisioning - live once Phase 35B ships. */
  studentLogins: boolean;
  /** CREATOR plans only: a minor learner's guardian gets access to their classes (dormant until creators Phase C5). */
  guardianAccess: boolean;
  status: PackageStatus;
}

export interface SavePackageRequest extends CreatorPlanLimitFields {
  name: string;
  description?: string;
  billingCycle: BillingCycle;
  audience: PackageAudience;
  free: boolean;
  prices: PackagePrice[];
  multiBranch: boolean;
  branchLimit: number;
  activeStudentLimit: number | null;
  takeHomeQuiz: boolean;
  onDemandLearning: boolean;
  communication: boolean;
  timetable: boolean;
  lessonNotes: boolean;
  aiLessonNotes: boolean;
  aiGenerationLimit: number;
  billing: boolean;
  learningMedia: boolean;
  studentLogins: boolean;
  guardianAccess: boolean;
}

const BASE = "/api/v1/admin/packages";

/** Every package, or only one audience's when `audience` is given. */
export function listPackages(page = 0, size = 20, audience?: PackageAudience): Promise<Page<PackageView>> {
  const audienceParam = audience ? `&audience=${audience}` : "";
  return apiFetch<Page<PackageView>>(`${BASE}?page=${page}&size=${size}${audienceParam}`);
}

export function getPackage(packageId: string): Promise<PackageView> {
  return apiFetch<PackageView>(`${BASE}/${packageId}`);
}

export function createPackage(request: SavePackageRequest): Promise<PackageView> {
  return apiFetch<PackageView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updatePackage(packageId: string, request: SavePackageRequest): Promise<PackageView> {
  return apiFetch<PackageView>(`${BASE}/${packageId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

/** RETIRED packages stay valid on any subscription already assigned but can't be picked for a new one. */
export function retirePackage(packageId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${packageId}/retire`, { method: "PATCH" });
}

export function reactivatePackage(packageId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${packageId}/reactivate`, { method: "PATCH" });
}
