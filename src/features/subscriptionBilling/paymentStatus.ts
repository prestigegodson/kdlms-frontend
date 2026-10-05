import type { PaymentTransactionStatus } from "@/api/subscriptionBilling";

type BadgeVariant = "neutral" | "success" | "warning" | "danger";

/** Badge colour per payment state - shared by the tenant's history and the system admin's list. */
export const PAYMENT_STATUS_VARIANT: Record<PaymentTransactionStatus, BadgeVariant> = {
  PENDING: "warning",
  SUCCESS: "success",
  FAILED: "danger",
  ABANDONED: "neutral",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentTransactionStatus, string> = {
  PENDING: "Pending",
  SUCCESS: "Paid",
  FAILED: "Failed",
  ABANDONED: "Not completed",
};
