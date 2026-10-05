import { apiFetch } from "@/api/client";
import type { BillingCycle, PackageView } from "@/api/packages";
import type { Page } from "@/api/types";
import type { SupportedCurrency } from "@/utils/currency";

/**
 * A tenant paying for its own KDLMS plan through Paystack (creators.md §6.1, Phase C8) - not to be
 * confused with `api/billing.ts`, a school billing its parents for fees.
 */

export type PaymentTransactionStatus = "PENDING" | "SUCCESS" | "FAILED" | "ABANDONED";
export type PaymentPurpose = "CHECKOUT" | "RENEWAL";

/** Mirrors backend payment.application.port.in.BillingSubscriptionView.CardView. */
export interface SavedCardView {
  brand: string | null;
  last4: string | null;
  expMonth: string | null;
  expYear: string | null;
  reusable: boolean;
}

/**
 * Mirrors backend payment.application.port.in.BillingSubscriptionView.CouponView - the coupon still
 * discounting renewals. `periodsRemaining` is null for one that lasts forever.
 */
export interface RunningCouponView {
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  currency: SupportedCurrency | null;
  periodsRemaining: number | null;
}

/**
 * Mirrors backend payment.application.port.in.BillingSubscriptionView. `active` is false when no
 * subscription is active today (a creator is then on the Free plan's fallback). `renewalPending`
 * means a renewal charge failed and is being retried until `graceUntil`.
 */
export interface BillingSubscriptionView {
  active: boolean;
  subscriptionId: string | null;
  packageId: string | null;
  planName: string | null;
  free: boolean;
  billingCycle: BillingCycle | null;
  source: "MANUAL" | "PAYSTACK" | null;
  startDate: string | null;
  endDate: string | null;
  graceUntil: string | null;
  renewalPending: boolean;
  autoRenew: boolean;
  currency: SupportedCurrency | null;
  amountMinor: number | null;
  card: SavedCardView | null;
  scheduledPackageId: string | null;
  scheduledPlanName: string | null;
  /** The coupon still discounting renewals (Phase C9), or null. */
  coupon: RunningCouponView | null;
  /** Whether Paystack is switched on for this deployment - checkout is a 503 when it isn't. */
  paymentsAvailable: boolean;
}

/** Mirrors backend payment.application.port.in.PaymentTransactionView. `schoolName` is filled for the system admin only. */
export interface PaymentTransactionView {
  id: string;
  reference: string;
  purpose: PaymentPurpose;
  status: PaymentTransactionStatus;
  packageId: string;
  planName: string | null;
  currency: SupportedCurrency;
  /** What was due after any coupon. */
  amountMinor: number;
  /** What a coupon took off the list price; 0 for none. */
  discountMinor: number;
  /** The coupon's code, on the tenant's own history only. */
  couponCode: string | null;
  gatewayMessage: string | null;
  paidAt: string | null;
  createdAt: string;
  schoolId: string;
  schoolName: string | null;
}

/** Mirrors backend payment.application.port.in.CheckoutUseCase.CheckoutResult. */
export interface CheckoutResult {
  /** A cheaper plan was scheduled for the next renewal - nothing to pay now. */
  scheduled: boolean;
  /** A coupon covered the whole price - the plan is already active, nothing to pay. */
  activated: boolean;
  reference: string | null;
  authorizationUrl: string | null;
  amountMinor: number;
  discountMinor: number;
  currency: SupportedCurrency;
}

export type CouponType = "PERCENT" | "FIXED";
export type CouponDuration = "ONCE" | "REPEATING" | "FOREVER";

/** Mirrors backend payment.application.port.in.PreviewCouponUseCase.CouponQuoteView. */
export interface CouponQuoteView {
  code: string;
  description: string | null;
  duration: CouponDuration;
  /** How many payments a REPEATING coupon discounts, the first included. */
  durationPeriods: number | null;
  currency: SupportedCurrency;
  listAmountMinor: number;
  discountMinor: number;
  amountDueMinor: number;
}

const BASE = "/api/v1/billing";

/** Every ACTIVE plan of the caller's own audience, the Free plan included. */
export function listBillablePlans(): Promise<PackageView[]> {
  return apiFetch<PackageView[]>(`${BASE}/plans`);
}

export function getBillingSubscription(): Promise<BillingSubscriptionView> {
  return apiFetch<BillingSubscriptionView>(`${BASE}/subscription`);
}

/** `couponCode` is optional; the server prices the checkout either way. */
export function checkout(
  packageId: string,
  currency: SupportedCurrency,
  couponCode?: string | null,
): Promise<CheckoutResult> {
  return apiFetch<CheckoutResult>(`${BASE}/checkout`, {
    method: "POST",
    body: JSON.stringify(
      couponCode ? { packageId, currency, couponCode } : { packageId, currency },
    ),
  });
}

/** What a coupon would take off a checkout - reserves nothing; a 422 carries the reason it can't be used. */
export function validateCoupon(
  code: string,
  packageId: string,
  currency: SupportedCurrency,
): Promise<CouponQuoteView> {
  return apiFetch<CouponQuoteView>(`${BASE}/coupons/validate`, {
    method: "POST",
    body: JSON.stringify({ code, packageId, currency }),
  });
}

export function setAutoRenew(enabled: boolean): Promise<BillingSubscriptionView> {
  return apiFetch<BillingSubscriptionView>(`${BASE}/subscription/auto-renew`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function cancelScheduledChange(): Promise<BillingSubscriptionView> {
  return apiFetch<BillingSubscriptionView>(`${BASE}/subscription/scheduled-change`, {
    method: "DELETE",
  });
}

/** One of the caller's own payments - what `/billing/callback` polls. Reading it never grants anything. */
export function getPaymentTransaction(reference: string): Promise<PaymentTransactionView> {
  return apiFetch<PaymentTransactionView>(`${BASE}/transactions/${encodeURIComponent(reference)}`);
}

export function listPaymentTransactions(
  page = 0,
  size = 10,
): Promise<Page<PaymentTransactionView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  return apiFetch<Page<PaymentTransactionView>>(`${BASE}/transactions?${params}`);
}

/** The system admin's cross-tenant list; `status` is optional. */
export function listAdminPaymentTransactions(
  status: PaymentTransactionStatus | "",
  page = 0,
  size = 20,
): Promise<Page<PaymentTransactionView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) {
    params.set("status", status);
  }
  return apiFetch<Page<PaymentTransactionView>>(`/api/v1/admin/payments/transactions?${params}`);
}
