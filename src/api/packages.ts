import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type BillingCycle = "MONTHLY" | "ANNUAL";
export type PackageStatus = "ACTIVE" | "RETIRED";

/** Mirrors backend subscription.application.port.in.PackageView. */
export interface PackageView {
  id: string;
  name: string;
  description?: string;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  multiBranch: boolean;
  branchLimit: number;
  activeStudentLimit: number;
  takeHomeQuiz: boolean;
  onDemandLearning: boolean;
  /** Unlike takeHomeQuiz/onDemandLearning, this flag actually gates the `communication` module - see CLAUDE.md. */
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
  status: PackageStatus;
}

export interface SavePackageRequest {
  name: string;
  description?: string;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  multiBranch: boolean;
  branchLimit: number;
  activeStudentLimit: number;
  takeHomeQuiz: boolean;
  onDemandLearning: boolean;
  communication: boolean;
  timetable: boolean;
  lessonNotes: boolean;
  aiLessonNotes: boolean;
  aiGenerationLimit: number;
}

const BASE = "/api/v1/admin/packages";

export function listPackages(page = 0, size = 20): Promise<Page<PackageView>> {
  return apiFetch<Page<PackageView>>(`${BASE}?page=${page}&size=${size}`);
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
