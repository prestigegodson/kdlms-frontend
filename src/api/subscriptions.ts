import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";

/** Mirrors backend subscription.application.port.in.SubscriptionView. */
export interface SubscriptionView {
  id: string;
  schoolId: string;
  packageId: string;
  packageName: string;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  daysRemaining: number;
}

export interface AssignSubscriptionRequest {
  packageId: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Mirrors backend subscription.application.port.in.SubscriptionSummaryView -
 * the caller's own school's plan, as shown in the school-portal banner and
 * self-service page. When {@code hasSubscription} is false every other
 * field but {@code status} ("NONE") and the usage counts is absent.
 */
export interface SubscriptionSummaryView {
  hasSubscription: boolean;
  packageName?: string;
  billingCycle?: string;
  price?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  status: SubscriptionStatus | "NONE";
  daysRemaining: number;
  multiBranch: boolean;
  branchLimit: number;
  branchesUsed: number;
  activeStudentLimit: number;
  activeStudentsUsed: number;
  takeHomeQuiz: boolean;
  onDemandLearning: boolean;
  communication: boolean;
  timetable: boolean;
}

function adminBase(schoolId: string): string {
  return `/api/v1/admin/schools/${schoolId}/subscriptions`;
}

// System-admin subscription management for a given school.

export function assignSubscription(
  schoolId: string,
  request: AssignSubscriptionRequest,
): Promise<SubscriptionView> {
  return apiFetch<SubscriptionView>(adminBase(schoolId), { method: "POST", body: JSON.stringify(request) });
}

/** Rejects with a 404 ApiError if the school has never had a subscription assigned. */
export function getCurrentSubscription(schoolId: string): Promise<SubscriptionView> {
  return apiFetch<SubscriptionView>(`${adminBase(schoolId)}/current`);
}

export function listSubscriptionHistory(schoolId: string, page = 0, size = 20): Promise<Page<SubscriptionView>> {
  return apiFetch<Page<SubscriptionView>>(`${adminBase(schoolId)}?page=${page}&size=${size}`);
}

export function extendSubscription(
  schoolId: string,
  subscriptionId: string,
  newEndDate: string,
): Promise<SubscriptionView> {
  return apiFetch<SubscriptionView>(`${adminBase(schoolId)}/${subscriptionId}/extend?newEndDate=${newEndDate}`, {
    method: "PATCH",
  });
}

export function suspendSubscription(schoolId: string, subscriptionId: string): Promise<void> {
  return apiFetch<void>(`${adminBase(schoolId)}/${subscriptionId}/suspend`, { method: "PATCH" });
}

export function resumeSubscription(schoolId: string, subscriptionId: string): Promise<void> {
  return apiFetch<void>(`${adminBase(schoolId)}/${subscriptionId}/resume`, { method: "PATCH" });
}

export function cancelSubscription(schoolId: string, subscriptionId: string): Promise<void> {
  return apiFetch<void>(`${adminBase(schoolId)}/${subscriptionId}/cancel`, { method: "PATCH" });
}

// School-portal self-service (the caller's own school - no id in the path).

export function getMySubscription(): Promise<SubscriptionSummaryView> {
  return apiFetch<SubscriptionSummaryView>("/api/v1/subscription");
}
