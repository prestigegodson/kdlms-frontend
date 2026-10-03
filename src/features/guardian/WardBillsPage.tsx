import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { getErrorMessage } from "@/api/client";
import { getWardFees, type WardFeeTermView } from "@/api/feePayments";
import { downloadWardBillPdf, getWardBill } from "@/api/wards";
import type { BillView } from "@/api/billing";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { BillCard } from "@/features/billing/components/BillCard";
import { LogPaymentSheet, type LogPaymentIntent } from "@/features/guardian/components/LogPaymentSheet";
import { WardFeeTermCard } from "@/features/guardian/components/WardFeeTermCard";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { usePageParam } from "@/hooks/usePageParam";
import { useFeatureStore } from "@/stores/featureStore";
import { useWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";
import { paginate } from "@/utils/paginate";

const TERMS_PER_PAGE = 6;

/**
 * A ward's bills, term by term (Phase 45G's Fees page, split back into Bills + Payments) - each
 * eligible term as a card with billed / paid / balance and the bill itself. The payments logged
 * against a term live on `WardPaymentsPage`, a table across every ward. The cards come
 * newest-first from `GET /api/v1/me/wards/{id}/fees`, so `WardSelector` alone docks in the
 * `StickySubHeader`, the `WardBillsPage` shape this page grew out of. "View bill" reuses
 * `BillCard` in a `Modal` with the same Download PDF idiom that page had. The cards are paged
 * client-side (`paginate`, `?page=` via `usePageParam`) since they already arrive whole.
 */
export function WardBillsPage() {
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

  const [pageIndex, setPageIndex] = usePageParam();
  const page = paginate(terms ?? [], pageIndex, TERMS_PER_PAGE);

  // `?page=` lives in the URL, so it can't be reset during render like the cards above - a real
  // ward switch (not the first mount, which may carry a deep-linked page) sends it back to page 1.
  const pagedSelectionKey = useRef(selectionKey);
  useEffect(() => {
    if (pagedSelectionKey.current === selectionKey) return;
    pagedSelectionKey.current = selectionKey;
    setPageIndex(0);
  }, [selectionKey, setPageIndex]);

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

  // ----- Log payment -----
  const [formIntent, setFormIntent] = useState<LogPaymentIntent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bills"
        description="Your ward's bills and balances."
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
          description="Bills appear here once your ward is enrolled for a term."
        />
      )}

      {terms && terms.length > 0 && selectedWardId && (
        <div className="space-y-4">
          {page.content.map((term) => (
            <WardFeeTermCard
              key={term.termId}
              term={term}
              canLog={canLog}
              onLogPayment={() => {
                setNotice(null);
                setFormIntent({ kind: "new", studentId: selectedWardId, term });
              }}
              onViewBill={() => openBill(term.termId)}
            />
          ))}
          {page.totalPages > 1 && <Pagination page={page} onPageChange={setPageIndex} />}
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

    </div>
  );
}
