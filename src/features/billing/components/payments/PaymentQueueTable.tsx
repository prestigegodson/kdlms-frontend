import { PAYMENT_METHOD_LABELS } from "@/api/feePayments";
import type { QueueItem } from "@/api/staffFeePayments";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { AllocationStatusBadge } from "@/features/billing/components/payments/AllocationStatusBadge";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

interface PaymentQueueTableProps {
  items: QueueItem[];
  /** Whether to show each child's branch - only useful school-wide. */
  showBranch: boolean;
  onOpen: (paymentId: string) => void;
}

/**
 * The payments review queue - one row per child (allocation), each carrying its payment's date,
 * payer and method so a row reads on its own as a card on a phone. A multi-child payment's rows
 * sit together (the queue pages by payment); clicking any of them opens the payment's review.
 */
export function PaymentQueueTable({ items, showBranch, onOpen }: PaymentQueueTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Paid on</TableHeaderCell>
          <TableHeaderCell>Student</TableHeaderCell>
          {showBranch && <TableHeaderCell>Branch</TableHeaderCell>}
          <TableHeaderCell>Payer</TableHeaderCell>
          <TableHeaderCell>Method</TableHeaderCell>
          <TableHeaderCell numeric>Amount</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Receipt</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.flatMap((item) =>
          item.allocations.map((allocation, index) => {
            const siblings = item.allocations.length + item.hiddenAllocationCount;
            return (
              <TableRow
                key={allocation.allocationId}
                onClick={() => onOpen(item.paymentId)}
                className={index > 0 ? "border-t-0" : ""}
              >
                <TableCell label="Paid on">{formatLongDate(item.paymentDate)}</TableCell>
                <TableCell label="Student">
                  <span className="block break-words font-medium text-slate-900">
                    {allocation.studentName}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[allocation.className, allocation.admissionNumber].filter(Boolean).join(" · ")}
                  </span>
                  {index === 0 && siblings > 1 && (
                    <span className="block text-xs text-slate-500">
                      One payment for {siblings} children
                      {item.hiddenAllocationCount > 0
                        ? ` (${item.hiddenAllocationCount} in another branch)`
                        : ""}
                    </span>
                  )}
                </TableCell>
                {showBranch && <TableCell label="Branch">{allocation.branchName ?? "—"}</TableCell>}
                <TableCell label="Payer">
                  <span className="break-words">{item.payerName}</span>
                </TableCell>
                <TableCell label="Method">{PAYMENT_METHOD_LABELS[item.method]}</TableCell>
                <TableCell label="Amount" numeric>
                  {formatMoney(
                    allocation.confirmedAmount ?? allocation.claimedAmount,
                    item.currency,
                  )}
                  {allocation.confirmedAmount !== null &&
                    allocation.confirmedAmount !== allocation.claimedAmount && (
                      <span className="block text-xs text-slate-500">
                        claimed {formatMoney(allocation.claimedAmount, item.currency)}
                      </span>
                    )}
                </TableCell>
                <TableCell label="Status">
                  <div className="flex flex-wrap gap-1">
                    <AllocationStatusBadge
                      status={allocation.status}
                      settlement={allocation.settlement}
                    />
                    {allocation.possibleDuplicate && (
                      <Badge variant="warning">Possible duplicate</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell label="Receipt">{allocation.receiptNumber ?? "—"}</TableCell>
              </TableRow>
            );
          }),
        )}
      </TableBody>
    </Table>
  );
}
