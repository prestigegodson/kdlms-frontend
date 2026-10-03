import { useCallback, useEffect, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { getErrorMessage } from "@/api/client";
import { getWardFees, withdrawFeePayment, type WardFeePaymentView, type WardFeeTermView } from "@/api/feePayments";
import { downloadWardBillPdf, getWardBill } from "@/api/wards";
import type { BillView } from "@/api/billing";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { BillCard } from "@/features/billing/components/BillCard";
import { LogPaymentSheet, type LogPaymentIntent } from "@/features/guardian/components/LogPaymentSheet";
import { WardFeeTermCard } from "@/features/guardian/components/WardFeeTermCard";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useFeatureStore } from "@/stores/featureStore";
import { useWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

/**
 * A ward's school fees, term by term (Phase 45G, replacing the Phase 21G Bills page) - each
 * eligible term as a card with billed / paid / balance, the bill itself, and the payments the
 * guardian (or another linked guardian, or the school) logged against it. The cards come
 * newest-first from `GET /api/v1/me/wards/{id}/fees`, so `WardSelector` alone docks in the
 * `StickySubHeader`, the `WardBillsPage` shape this page grew out of. "View bill" reuses
 * `BillCard` in a `Modal` with the same Download PDF idiom that page had.
 */
export function WardFeesPage() {
  const { wards, selectedWardId, status, errorMessage: wardsError, fetchIfNeeded, retry } = useWardStore();
  const billingEntitled = useFeatureStore((state) => state.billing);
  const canLog = can.logWardPayment("GUARDIAN", billingEntitled);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [terms, setTerms] = useState<WardFeeTermView[] | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  // A ward change resets its cards during render (the WardTakeHomeQuizzesPage pattern) rather
  // than inside the effect below, which only fetches.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setTerms(null);
    setTermsError(null);
  }

  const loadTerms = useCallback((studentId: string) => {
    return getWardFees(studentId)
      .then(setTerms)
      .catch((error: unknown) => setTermsError(getErrorMessage(error, "Failed to load this ward's fees")));
  }, []);

  useEffect(() => {
    if (!selectedWardId) return;
    loadTerms(selectedWardId);
  }, [selectedWardId, loadTerms]);

  function refresh() {
    if (selectedWardId) loadTerms(selectedWardId);
  }

  // ----- View bill -----
  const [billTermId, setBillTermId] = useState<string | null>(null);
  const [bill, setBill] = useState<BillView | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function openBill(termId: string) {
    if (!selectedWardId) return;
    setBillTermId(termId);
    setBill(null);
    setBillError(null);
    setDownloadError(null);
    getWardBill(selectedWardId, termId)
      .then(setBill)
      .catch((error: unknown) => setBillError(getErrorMessage(error, "Failed to load this bill")));
  }

  function closeBill() {
    setBillTermId(null);
    setBill(null);
    setBillError(null);
    setDownloadError(null);
  }

  async function downloadPdf() {
    if (!selectedWardId || !billTermId || !bill) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadWardBillPdf(selectedWardId, billTermId);
      downloadBlob(blob, `${bill.admissionNumber}-bill-${bill.termName}.pdf`);
    } catch (error) {
      setDownloadError(getErrorMessage(error, "Failed to download the bill"));
    } finally {
      setDownloading(false);
    }
  }

  // ----- Log / edit / resubmit / withdraw -----
  const [formIntent, setFormIntent] = useState<LogPaymentIntent | null>(null);
  const [withdrawing, setWithdrawing] = useState<{ payment: WardFeePaymentView; currency: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirmWithdraw() {
    if (!withdrawing) return;
    await withdrawFeePayment(withdrawing.payment.paymentId);
    setWithdrawing(null);
    setNotice("Payment withdrawn.");
    refresh();
  }

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees"
        description="Your ward's bills, payments and balances."
        actions={
          hasWards &&
          canLog && (
            <Button
              onClick={() => {
                setNotice(null);
                setFormIntent({ kind: "open" });
              }}
            >
              <Wallet className="h-4 w-4" aria-hidden="true" /> Log payment
            </Button>
          )
        }
      />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
        </StickySubHeader>
      )}

      {notice && <Alert variant="success">{notice}</Alert>}
      {termsError && <Alert variant="error">{termsError}</Alert>}

      {hasWards && terms === null && !termsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading fees…
        </div>
      )}

      {terms && terms.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="No terms yet"
          description="Fees appear here once your ward is enrolled for a term."
        />
      )}

      {terms && terms.length > 0 && selectedWardId && (
        <div className="space-y-4">
          {terms.map((term) => (
            <WardFeeTermCard
              key={term.termId}
              term={term}
              canLog={canLog}
              onLogPayment={() => {
                setNotice(null);
                setFormIntent({ kind: "new", studentId: selectedWardId, term });
              }}
              onViewBill={() => openBill(term.termId)}
              onEditPayment={(payment) => {
                setNotice(null);
                setFormIntent({ kind: "edit", studentId: selectedWardId, term, payment });
              }}
              onWithdrawPayment={(payment) => {
                setNotice(null);
                setWithdrawing({ payment, currency: term.currency });
              }}
              onResubmitPayment={(payment) => {
                setNotice(null);
                setFormIntent({ kind: "resubmit", studentId: selectedWardId, term, payment });
              }}
            />
          ))}
        </div>
      )}

      <Modal open={billTermId !== null} onClose={closeBill} title={bill ? `${bill.termName} bill` : "Bill"} size="xl">
        {billError && <Alert variant="error">{billError}</Alert>}
        {!bill && !billError && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
        {bill && (
          <div className="space-y-4">
            <BillCard bill={bill} />
            {downloadError && <Alert variant="error">{downloadError}</Alert>}
            <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
            </Button>
          </div>
        )}
      </Modal>

      <LogPaymentSheet
        intent={formIntent}
        wards={wards}
        onClose={() => setFormIntent(null)}
        onSubmitted={(message) => {
          setFormIntent(null);
          setNotice(message);
          refresh();
        }}
      />

      {withdrawing && (
        <ConfirmDialog
          title="Withdraw payment"
          message={
            <>
              Withdraw your {formatMoney(withdrawing.payment.totalAmount, withdrawing.currency)} payment of{" "}
              {formatLongDate(withdrawing.payment.paymentDate)}? The proof you attached will be deleted
              {withdrawing.payment.childCount > 1
                ? `, and it's withdrawn for all ${withdrawing.payment.childCount} children`
                : ""}
              .
            </>
          }
          confirmLabel="Withdraw"
          variant="danger"
          onConfirm={confirmWithdraw}
          onClose={() => setWithdrawing(null)}
        />
      )}
    </div>
  );
}
