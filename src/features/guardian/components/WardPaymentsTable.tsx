import { PAYMENT_METHOD_LABELS, type WardFeePaymentView, type WardFeeTermView } from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { PaymentFileLinks, PaymentStatusBadge } from "@/features/guardian/components/paymentDisplay";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

/** One ward's share of one fee-payment submission, with the ward and term it belongs to. */
export interface WardPaymentRowData {
  ward: MyWardView;
  term: WardFeeTermView;
  payment: WardFeePaymentView;
}

interface WardPaymentsTableProps {
  rows: WardPaymentRowData[];
  /** Adds the school name under each child's name - only when the guardian's wards span schools. */
  showSchool: boolean;
  onEdit: (row: WardPaymentRowData) => void;
  onWithdraw: (row: WardPaymentRowData) => void;
  onResubmit: (row: WardPaymentRowData) => void;
}

/**
 * Every payment the guardian's wards have against them, one row per child allocation (a payment
 * covering siblings is one row per child, since each child's share is reviewed on its own). A
 * confirmed amount the school adjusted shows in place of the claimed one, with the claim kept
 * alongside; receipts and proof of payment sit behind a per-row Documents menu; the submitter's own Edit/Withdraw (while pending) or Resubmit (once rejected) sit in
 * the last column.
 */
export function WardPaymentsTable({ rows, showSchool, onEdit, onWithdraw, onResubmit }: WardPaymentsTableProps) {
  return (
    <Table aria-label="Payments">
      <TableHead>
        <tr>
          <TableHeaderCell>Date</TableHeaderCell>
          <TableHeaderCell>Child</TableHeaderCell>
          <TableHeaderCell>Term</TableHeaderCell>
          <TableHeaderCell numeric>Amount</TableHeaderCell>
          <TableHeaderCell>Method</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Documents</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const { ward, term, payment } = row;
          const currency = term.currency;
          const adjusted = payment.confirmedAmount != null && payment.confirmedAmount !== payment.claimedAmount;
          const shownAmount = adjusted ? payment.confirmedAmount : payment.claimedAmount;
          const canResubmit = payment.status === "REJECTED" && payment.submittedByMe;
          const showReason = payment.reason && (payment.status === "REJECTED" || payment.status === "VOIDED");

          return (
            <TableRow key={payment.allocationId}>
              <TableCell label="Date" className="whitespace-nowrap">
                {formatLongDate(payment.paymentDate)}
              </TableCell>
              <TableCell label="Child">
                <span className="font-medium text-slate-900">{ward.fullName}</span>
                {showSchool && <span className="block text-xs text-slate-500">{ward.schoolName}</span>}
              </TableCell>
              <TableCell label="Term">
                {term.termName}
                <span className="block text-xs text-slate-500">{term.sessionName}</span>
              </TableCell>
              <TableCell label="Amount" numeric>
                <span className="font-semibold text-slate-900">{formatMoney(shownAmount, currency)}</span>
                {adjusted && (
                  <span className="block text-xs text-slate-500">
                    You logged {formatMoney(payment.claimedAmount, currency)}
                  </span>
                )}
                {payment.childCount > 1 && (
                  <span className="block text-xs text-slate-500">
                    Part of {formatMoney(payment.totalAmount, currency)} for {payment.childCount} children
                  </span>
                )}
              </TableCell>
              <TableCell label="Method">{PAYMENT_METHOD_LABELS[payment.method]}</TableCell>
              <TableCell label="Status">
                <PaymentStatusBadge payment={payment} />
                {showReason && (
                  <span className={`mt-1 block text-xs ${payment.status === "REJECTED" ? "text-red-700" : "text-amber-700"}`}>
                    {payment.status === "REJECTED" ? "Rejected: " : "Voided: "}
                    {payment.reason}
                  </span>
                )}
              </TableCell>
              <TableCell label="Documents">
                <PaymentFileLinks
                  payment={payment}
                  ariaLabel={`Documents for ${ward.fullName}, ${formatLongDate(payment.paymentDate)}`}
                />
              </TableCell>
              <TableCell label="Actions">
                {(payment.canEdit || canResubmit) && (
                  <div className="flex gap-2">
                    {payment.canEdit && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-700" onClick={() => onWithdraw(row)}>
                          Withdraw
                        </Button>
                      </>
                    )}
                    {canResubmit && (
                      <Button variant="secondary" size="sm" onClick={() => onResubmit(row)}>
                        Resubmit
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
