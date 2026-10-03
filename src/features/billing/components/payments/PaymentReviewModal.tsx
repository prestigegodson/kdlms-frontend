import { useEffect, useState } from "react";
import { ApiError, getErrorMessage } from "@/api/client";
import { PAYMENT_METHOD_LABELS } from "@/api/feePayments";
import { getFeePayment, reviewFeePayment, type StaffFeePaymentView } from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { AllocationReviewCard } from "@/features/billing/components/payments/AllocationReviewCard";
import { AttachmentViewer } from "@/features/billing/components/payments/AttachmentViewer";
import {
  COMBINED_STATUS_LABELS,
  SOURCE_LABELS,
} from "@/features/billing/components/payments/paymentLabels";
import {
  type AllocationDraft,
  type AllocationDrafts,
  buildReviewItems,
  initialAllocationDrafts,
  reviewSubmittable,
} from "@/features/billing/components/payments/reviewDraft";
import { usePaymentAllocationActions } from "@/features/billing/components/payments/usePaymentAllocationActions";
import { usePendingFeePaymentsStore } from "@/stores/pendingFeePaymentsStore";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

interface PaymentReviewModalProps {
  paymentId: string | null;
  onClose: () => void;
  /** Called after any successful write, so the opener refreshes its queue/roster. */
  onChanged: () => void;
}

/**
 * Reviewing one payment (Phase 45I, D4/D5/D8/D11): its proof, and per child the live bill,
 * paid so far, balance and claim, with Confirm (amount, Partial/Full, optional fees) or Reject
 * (reason) - all sent in one review that echoes each child's version, so a concurrent review is a
 * 409 that reloads rather than overwrites. Full-screen on a phone.
 */
export function PaymentReviewModal({ paymentId, onClose, onChanged }: PaymentReviewModalProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={paymentId !== null}
      onClose={() => !busy && onClose()}
      title="Review payment"
      size="xxl"
      fullScreenOnMobile
    >
      {paymentId && (
        <ReviewFlow
          key={paymentId}
          paymentId={paymentId}
          onBusyChange={setBusy}
          onChanged={onChanged}
        />
      )}
    </Modal>
  );
}

function ReviewFlow({
  paymentId,
  onBusyChange,
  onChanged,
}: {
  paymentId: string;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => void;
}) {
  const [view, setView] = useState<StaffFeePaymentView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<AllocationDrafts>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refreshPending = usePendingFeePaymentsStore((state) => state.refresh);

  function show(next: StaffFeePaymentView) {
    setView(next);
    setDrafts(initialAllocationDrafts(next.allocations));
  }

  useEffect(() => {
    let cancelled = false;
    getFeePayment(paymentId)
      .then((next) => {
        if (cancelled) return;
        setView(next);
        setDrafts(initialAllocationDrafts(next.allocations));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getErrorMessage(error, "Couldn't load this payment"));
      });
    return () => {
      cancelled = true;
    };
  }, [paymentId, attempt]);

  const actions = usePaymentAllocationActions((next) => {
    show(next);
    setNotice("Payment updated.");
    onChanged();
  });

  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => {
          setLoadError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!view) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const pendingCount = view.allocations.filter(
    (allocation) => allocation.status === "PENDING",
  ).length;
  const canSubmit = reviewSubmittable(drafts);

  function patchDraft(allocationId: string, patch: Partial<AllocationDraft>) {
    setDrafts((current) => ({
      ...current,
      [allocationId]: { ...current[allocationId], ...patch },
    }));
  }

  async function submit() {
    if (!view || !canSubmit || submitting) return;
    setSubmitting(true);
    onBusyChange(true);
    setSubmitError(null);
    setNotice(null);
    try {
      const next = await reviewFeePayment(view.id, buildReviewItems(view.allocations, drafts));
      show(next);
      setNotice("Review saved.");
      refreshPending();
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSubmitError(
          "This payment changed while you were reviewing it - it has been reloaded. Check it and try again.",
        );
        getFeePayment(view.id)
          .then(show)
          .catch(() => undefined);
      } else {
        setSubmitError(getErrorMessage(error, "Couldn't save the review"));
      }
    } finally {
      setSubmitting(false);
      onBusyChange(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-5 pb-4">
        <section aria-label="Payment" className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-semibold text-slate-900">
              {formatMoney(view.totalAmount, view.currency)}
            </p>
            <div className="flex flex-wrap gap-1">
              <Badge variant="neutral">{COMBINED_STATUS_LABELS[view.status]}</Badge>
              <Badge variant="neutral">{SOURCE_LABELS[view.source]}</Badge>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500">Term</dt>
            <dd className="text-slate-800">{view.termName}</dd>
            <dt className="text-slate-500">Payer</dt>
            <dd className="break-words text-slate-800">{view.payerName}</dd>
            <dt className="text-slate-500">Paid on</dt>
            <dd className="text-slate-800">{formatLongDate(view.paymentDate)}</dd>
            <dt className="text-slate-500">Method</dt>
            <dd className="text-slate-800">{PAYMENT_METHOD_LABELS[view.method]}</dd>
            {view.note && (
              <>
                <dt className="text-slate-500">Note</dt>
                <dd className="break-words text-slate-800">{view.note}</dd>
              </>
            )}
          </dl>
          {view.hiddenAllocationCount > 0 && (
            <p className="text-xs text-slate-500">
              This payment also covers {view.hiddenAllocationCount} child
              {view.hiddenAllocationCount === 1 ? "" : "ren"} in another branch, reviewed there.
            </p>
          )}
        </section>

        <section aria-label="Proof of payment" className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">Proof</h3>
          <AttachmentViewer paymentId={view.id} attachments={view.attachments} />
        </section>

        <section aria-label="Children" className="space-y-3">
          {view.allocations.map((allocation) => (
            <AllocationReviewCard
              key={allocation.id}
              allocation={allocation}
              currency={view.currency}
              draft={drafts[allocation.id]}
              onDraftChange={(patch) => patchDraft(allocation.id, patch)}
              onVoid={() => actions.openVoid(allocation)}
              onCorrect={() => actions.openCorrect(allocation, view.currency)}
              disabled={submitting}
            />
          ))}
        </section>

        {notice && <Alert variant="success">{notice}</Alert>}
        {submitError && <Alert variant="error">{submitError}</Alert>}
      </div>

      {pendingCount > 0 && (
        <div
          data-sheet-dock
          className="mt-auto flex border-t border-slate-100 pt-4 mobile:sticky mobile:bottom-0 mobile:-mx-6 mobile:bg-white/95 mobile:px-6 mobile:pb-4 mobile:backdrop-blur sm:justify-end"
        >
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={submit}
            loading={submitting}
            disabled={!canSubmit}
          >
            Submit review
          </Button>
        </div>
      )}

      {actions.dialogs}
    </div>
  );
}
