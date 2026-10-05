import { apiFetch } from "@/api/client";
import type { CouponDuration, CouponType } from "@/api/subscriptionBilling";
import type { Page } from "@/api/types";
import type { SupportedCurrency } from "@/utils/currency";

/** The system admin's coupon catalogue (creators.md §6.2, Phase C9). */

export type CouponAudience = "CREATOR" | "SCHOOL" | "ANY";
export type CouponStatus = "ACTIVE" | "DISABLED";

/** Mirrors backend payment.application.port.in.ManageCouponsUseCase.CouponView. */
export interface CouponView {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  /** A percentage for PERCENT, minor units of `currency` for FIXED. */
  value: number;
  currency: SupportedCurrency | null;
  duration: CouponDuration;
  durationPeriods: number | null;
  audience: CouponAudience;
  validFrom: string;
  validUntil: string | null;
  maxRedemptions: number | null;
  status: CouponStatus;
  packages: { id: string; name: string | null }[];
  pendingRedemptions: number;
  redeemedRedemptions: number;
  /** Nobody has ever used it - otherwise it can only be disabled. */
  deletable: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors ManageCouponsUseCase.RedemptionView. */
export interface CouponRedemptionView {
  id: string;
  schoolId: string;
  schoolName: string | null;
  status: "PENDING" | "REDEEMED" | "RELEASED";
  periodsRemaining: number | null;
  redeemedAt: string | null;
  createdAt: string;
}

/** The editable half of a coupon - its terms are fixed once created. */
export interface CouponSettingsRequest {
  description: string | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  status: CouponStatus;
  packageIds: string[];
}

export interface CreateCouponRequest extends CouponSettingsRequest {
  code: string;
  type: CouponType;
  value: number;
  currency: SupportedCurrency | null;
  duration: CouponDuration;
  durationPeriods: number | null;
  audience: CouponAudience;
}

const BASE = "/api/v1/admin/coupons";

export function listCoupons(
  query: string,
  status: CouponStatus | "",
  page = 0,
  size = 20,
): Promise<Page<CouponView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("q", query.trim());
  if (status) params.set("status", status);
  return apiFetch<Page<CouponView>>(`${BASE}?${params}`);
}

export function createCoupon(request: CreateCouponRequest): Promise<CouponView> {
  return apiFetch<CouponView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateCoupon(id: string, request: CouponSettingsRequest): Promise<CouponView> {
  return apiFetch<CouponView>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(request) });
}

export function deleteCoupon(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
}

export function listCouponRedemptions(
  id: string,
  page = 0,
  size = 20,
): Promise<Page<CouponRedemptionView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiFetch<Page<CouponRedemptionView>>(`${BASE}/${id}/redemptions?${params}`);
}
