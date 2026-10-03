import type { AllocationStatus, Settlement } from "@/api/feePayments";
import { Badge } from "@/components/ui/Badge";
import {
  ALLOCATION_BADGES,
  SETTLEMENT_LABELS,
} from "@/features/billing/components/payments/paymentLabels";

/** One child's allocation status, with its settlement once confirmed (e.g. "Confirmed · Part payment"). */
export function AllocationStatusBadge({
  status,
  settlement,
}: {
  status: AllocationStatus;
  settlement?: Settlement | null;
}) {
  const badge = ALLOCATION_BADGES[status];
  return (
    <Badge variant={badge.variant}>
      {badge.label}
      {status === "CONFIRMED" && settlement ? ` · ${SETTLEMENT_LABELS[settlement]}` : ""}
    </Badge>
  );
}
