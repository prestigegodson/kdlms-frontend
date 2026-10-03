import type { TermPaymentState } from "@/api/feePayments";
import { Badge } from "@/components/ui/Badge";

const STATE_BADGES: Record<TermPaymentState, { label: string; variant: "neutral" | "info" | "warning" | "success" }> = {
  UNPAID: { label: "Unpaid", variant: "neutral" },
  PENDING_CONFIRMATION: { label: "Pending confirmation", variant: "info" },
  PART_PAID: { label: "Part-paid", variant: "warning" },
  PAID_IN_FULL: { label: "Paid in full", variant: "success" },
};

interface TermPaymentStatusBadgeProps {
  status: TermPaymentState;
  hasPending: boolean;
  inCredit: boolean;
}

/**
 * A student's derived term payment status (backend `TermPaymentStatus.derive`, Phase 45) as one
 * badge - shared by the guardian Fees page and the staff Bills roster so the two can't word it
 * differently. A credit (an overpayment) replaces the state label, and a further pending
 * submission on top of a settled state reads "· pending" (e.g. "Part-paid · pending").
 */
export function TermPaymentStatusBadge({ status, hasPending, inCredit }: TermPaymentStatusBadgeProps) {
  const base = inCredit ? { label: "Credit", variant: "brand" as const } : STATE_BADGES[status];
  const showPending = hasPending && status !== "PENDING_CONFIRMATION";
  return (
    <Badge variant={base.variant}>
      {base.label}
      {showPending ? " · pending" : ""}
    </Badge>
  );
}
