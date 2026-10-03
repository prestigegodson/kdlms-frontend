import type {
  AllocationStatus,
  CombinedPaymentStatus,
  PaymentSource,
  Settlement,
} from "@/api/feePayments";

export type BadgeVariant = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

export const ALLOCATION_BADGES: Record<AllocationStatus, { label: string; variant: BadgeVariant }> =
  {
    PENDING: { label: "Pending", variant: "info" },
    CONFIRMED: { label: "Confirmed", variant: "success" },
    REJECTED: { label: "Rejected", variant: "danger" },
    WITHDRAWN: { label: "Withdrawn", variant: "neutral" },
    VOIDED: { label: "Voided", variant: "neutral" },
  };

export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  VOIDED: "Voided",
};

export const COMBINED_STATUS_LABELS: Record<CombinedPaymentStatus, string> = {
  PENDING: "Pending",
  PARTIALLY_REVIEWED: "Partly reviewed",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  VOIDED: "Voided",
  MIXED: "Mixed",
};

export const SETTLEMENT_LABELS: Record<Settlement, string> = {
  PARTIAL: "Part payment",
  FULL: "Paid in full",
};

export const SOURCE_LABELS: Record<PaymentSource, string> = {
  GUARDIAN: "Logged by guardian",
  STAFF: "Recorded by staff",
};
