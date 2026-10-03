import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { PAYMENT_METHOD_LABELS } from "@/api/feePayments";
import { getStudentPaymentLedger, type StudentPaymentLedgerView } from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { TermPaymentStatusBadge } from "@/features/billing/components/TermPaymentStatusBadge";
import { AllocationStatusBadge } from "@/features/billing/components/payments/AllocationStatusBadge";
import { ReceiptDownloads } from "@/features/billing/components/payments/ReceiptDownloads";
import {
  RecordPaymentModal,
  type RecordPaymentTarget,
} from "@/features/billing/components/payments/RecordPaymentModal";
import { usePaymentAllocationActions } from "@/features/billing/components/payments/usePaymentAllocationActions";
import type { StudentSearchSelection } from "@/features/students/components/StudentSearchField";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

interface StudentPaymentsSectionProps {
  student: StudentSearchSelection;
  termId: string;
  /** The branch Record payment's student search starts in. */
  branchId?: string;
  /** Called after any write, so the roster behind the preview refreshes its Paid/Balance columns. */
  onChanged: () => void;
}

/**
 * One student's payments for a term inside their bill preview (Phase 45I): the term's paid /
 * pending / balance, each payment with its status and receipts, Void and Correct amount on a
 * confirmed one (D11), and Record payment prefilled with this student.
 */
export function StudentPaymentsSection({
  student,
  termId,
  branchId,
  onChanged,
}: StudentPaymentsSectionProps) {
  const [ledger, setLedger] = useState<StudentPaymentLedgerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [recordTarget, setRecordTarget] = useState<RecordPaymentTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudentPaymentLedger(student.id, termId)
      .then((next) => {
        if (!cancelled) setLedger(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err, "Couldn't load payments"));
      });
    return () => {
      cancelled = true;
    };
  }, [student.id, termId, refreshKey]);

  function changed(message: string) {
    setNotice(message);
    setRefreshKey((n) => n + 1);
    onChanged();
  }

  const actions = usePaymentAllocationActions(() => changed("Payment updated."));
  const term = ledger?.terms.find((candidate) => candidate.termId === termId);

  return (
    <section aria-label="Payments" className="space-y-3 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Payments</h3>
        {term && (
          <TermPaymentStatusBadge
            status={term.status.state}
            hasPending={term.status.hasPending}
            inCredit={term.status.inCredit}
          />
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {!error && !ledger && <Skeleton className="h-20 w-full" />}

      {ledger && term && (
        <>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Paid</dt>
              <dd className="font-medium text-slate-900">
                {formatMoney(term.status.confirmedPaid, ledger.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Pending</dt>
              <dd className="font-medium text-slate-900">
                {formatMoney(term.status.pendingAmount, ledger.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">
                {term.status.balance !== null && term.status.balance < 0 ? "Credit" : "Balance"}
              </dt>
              <dd className="font-medium text-slate-900">
                {term.status.balance === null
                  ? "No bill"
                  : formatMoney(Math.abs(term.status.balance), ledger.currency)}
              </dd>
            </div>
          </dl>

          {term.payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payments for this term yet.</p>
          ) : (
            <ul className="space-y-2">
              {term.payments.map((entry) => {
                const allocation = entry.allocation;
                return (
                  <li
                    key={allocation.id}
                    className="space-y-2 rounded-control border border-slate-200 p-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {formatMoney(
                          allocation.confirmedAmount ?? allocation.claimedAmount,
                          ledger.currency,
                        )}
                      </span>
                      <AllocationStatusBadge
                        status={allocation.status}
                        settlement={allocation.settlement}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatLongDate(entry.paymentDate)} · {PAYMENT_METHOD_LABELS[entry.method]} ·{" "}
                      {entry.payerName}
                      {entry.childCount > 1
                        ? ` · one payment for ${entry.childCount} children`
                        : ""}
                    </p>
                    {allocation.reason && (
                      <p className="text-sm text-slate-700">Reason: {allocation.reason}</p>
                    )}
                    {allocation.status === "CONFIRMED" && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => actions.openCorrect(allocation, ledger.currency)}
                        >
                          Correct amount
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => actions.openVoid(allocation)}
                        >
                          Void
                        </Button>
                      </div>
                    )}
                    <ReceiptDownloads receipts={allocation.receipts} />
                  </li>
                );
              })}
            </ul>
          )}

          <Button
            variant="secondary"
            onClick={() =>
              setRecordTarget({
                termId,
                termLabel: term.termName,
                currency: ledger.currency,
                branchId,
                student,
              })
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Record payment
          </Button>
        </>
      )}

      {actions.dialogs}
      <RecordPaymentModal
        target={recordTarget}
        onClose={() => setRecordTarget(null)}
        onRecorded={(message) => {
          setRecordTarget(null);
          changed(message);
        }}
      />
    </section>
  );
}
