import { Badge } from "@/components/ui/Badge";
import type { RequisitionStatus } from "@/api/inventory";

const VARIANT_BY_STATUS: Record<RequisitionStatus, "neutral" | "brand" | "success" | "danger" | "warning"> = {
  DRAFT: "neutral",
  SUBMITTED: "brand",
  APPROVED: "warning",
  REJECTED: "danger",
  ISSUED: "success",
  CANCELLED: "neutral",
};

const LABEL_BY_STATUS: Record<RequisitionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ISSUED: "Issued",
  CANCELLED: "Cancelled",
};

/** One Badge variant per requisition status - the shared source every list row and detail view reads from. */
export function RequisitionStatusBadge({ status }: { status: RequisitionStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{LABEL_BY_STATUS[status]}</Badge>;
}
