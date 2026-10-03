import type { AllocationStatus, WardFeePaymentView } from "@/api/feePayments";

/** A guardian-facing label and badge variant per allocation status - the Payments table and its status filter. */
export const PAYMENT_STATUS_BADGES: Record<
  AllocationStatus,
  { label: string; variant: "neutral" | "info" | "success" | "danger" }
> = {
  PENDING: { label: "Pending confirmation", variant: "info" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  WITHDRAWN: { label: "Withdrawn", variant: "neutral" },
  VOIDED: { label: "Voided", variant: "neutral" },
};

export function paymentStatusLabel(payment: WardFeePaymentView): string {
  const base = PAYMENT_STATUS_BADGES[payment.status].label;
  if (payment.status !== "CONFIRMED" || !payment.settlement) return base;
  return `${base} · ${payment.settlement === "FULL" ? "paid in full" : "part payment"}`;
}
