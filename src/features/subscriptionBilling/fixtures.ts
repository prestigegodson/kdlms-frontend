import type { PackageView } from "@/api/packages";
import type { BillingSubscriptionView, PaymentTransactionView } from "@/api/subscriptionBilling";

/** Test fixtures for the plan-billing pages. */
export function plan(overrides: Partial<PackageView> = {}): PackageView {
  return {
    id: "pkg-pro",
    name: "Pro",
    billingCycle: "MONTHLY",
    audience: "CREATOR",
    free: false,
    prices: [{ currency: "NGN", amountMinor: 500_000 }],
    multiBranch: false,
    branchLimit: 1,
    activeStudentLimit: null,
    maxClasses: 5,
    maxStudentsPerClass: 20,
    maxSessionMinutes: 60,
    maxParticipantsPerSession: 25,
    maxMonthlySessionHours: 20,
    takeHomeQuiz: true,
    onDemandLearning: true,
    communication: true,
    timetable: false,
    lessonNotes: true,
    aiLessonNotes: false,
    aiGenerationLimit: 0,
    billing: false,
    learningMedia: false,
    studentLogins: false,
    guardianAccess: true,
    status: "ACTIVE",
    ...overrides,
  };
}

export function subscription(
  overrides: Partial<BillingSubscriptionView> = {},
): BillingSubscriptionView {
  return {
    active: true,
    subscriptionId: "sub-1",
    packageId: "pkg-free",
    planName: "Free",
    free: true,
    billingCycle: "MONTHLY",
    source: "MANUAL",
    startDate: "2026-10-01",
    endDate: null,
    graceUntil: null,
    renewalPending: false,
    autoRenew: false,
    currency: null,
    amountMinor: null,
    card: null,
    scheduledPackageId: null,
    scheduledPlanName: null,
    coupon: null,
    paymentsAvailable: true,
    ...overrides,
  };
}

export function payment(overrides: Partial<PaymentTransactionView> = {}): PaymentTransactionView {
  return {
    id: "tx-1",
    reference: "KDL-1",
    purpose: "CHECKOUT",
    status: "SUCCESS",
    packageId: "pkg-pro",
    planName: "Pro",
    currency: "NGN",
    amountMinor: 500_000,
    discountMinor: 0,
    couponCode: null,
    gatewayMessage: null,
    paidAt: "2026-10-05T10:00:00Z",
    createdAt: "2026-10-05T09:59:00Z",
    schoolId: "tenant-1",
    schoolName: null,
    ...overrides,
  };
}

export const EMPTY_PAGE = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 };
