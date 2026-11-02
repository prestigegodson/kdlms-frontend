import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Wallet } from "lucide-react";
import { getErrorMessage } from "@/api/client";
import { getWardFees, type WardFeeTermView } from "@/api/feePayments";
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
import { Tabs } from "@/components/ui/Tabs";
import { LogPaymentSheet, type LogPaymentIntent } from "@/features/guardian/components/LogPaymentSheet";
import { WardBillDetail } from "@/features/guardian/components/WardBillDetail";
import { WardFeeTermCard } from "@/features/guardian/components/WardFeeTermCard";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { latestBill, pastBills } from "@/features/guardian/wardBillHistory";
import { usePageParam } from "@/hooks/usePageParam";
import { useFeatureStore } from "@/stores/featureStore";
import { useWardStore } from "@/stores/wardStore";
import { paginate } from "@/utils/paginate";

type BillsTab = "latest" | "past";

const TABS: Array<{ value: BillsTab; label: string }> = [
  { value: "latest", label: "Latest bill" },
  { value: "past", label: "Past bills" },
];

const TERMS_PER_PAGE = 6;

/**
 * A ward's bills, laid out like `WardResultsHomePage`: the latest bill (`latestBill` - the newest
 * published one, else the current term) in full on the Latest tab, and every other term as a
 * card one tab over. The tab lives in `?tab=past`; the Past tab pages its cards client-side
 * (`paginate`, `?page=` via `usePageParam`) since `GET /api/v1/me/wards/{id}/fees` returns them
 * whole, newest-first. The payments logged against a term live on `WardPaymentsPage`.
 */
export function WardBillsPage() {
  const { wards, selectedWardId, status, errorMessage: wardsError, fetchIfNeeded, retry } = useWardStore();
  const billingEntitled = useFeatureStore((state) => state.billing);
  const canLog = can.logWardPayment("GUARDIAN", billingEntitled);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: BillsTab = searchParams.get("tab") === "past" ? "past" : "latest";

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

  // `?page=` lives in the URL, so it can't be reset during render like the cards above - a real
  // ward switch (not the first mount, which may carry a deep-linked page) sends it back to page 1.
  // `setPageIndex` only drops `page`, so the tab survives the switch.
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

  function changeTab(next: BillsTab) {
    // Drops `?page=` too - a page index means nothing on the other tab.
    setSearchParams(next === "past" ? { tab: "past" } : {});
  }

  // ----- View bill (Past tab) -----
  const [billTerm, setBillTerm] = useState<WardFeeTermView | null>(null);

  // ----- Log payment -----
  const [formIntent, setFormIntent] = useState<LogPaymentIntent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function logPaymentFor(studentId: string, term: WardFeeTermView) {
    setNotice(null);
    setFormIntent({ kind: "new", studentId, term });
  }

  const hasWards = status === "loaded" && wards.length > 0;
  const latest = terms ? latestBill(terms) : null;
  const past = terms ? pastBills(terms, latest) : [];
  const page = paginate(past, pageIndex, TERMS_PER_PAGE);

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

      {hasWards && <Tabs ariaLabel="Bills" value={tab} onChange={changeTab} items={TABS} />}

      {hasWards && terms === null && !termsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading fees…
        </div>
      )}

      {terms && selectedWardId && tab === "latest" && (
        <>
          {latest ? (
            <div className="space-y-4">
              <WardFeeTermCard
                term={latest}
                canLog={canLog}
                onLogPayment={() => logPaymentFor(selectedWardId, latest)}
              />
              {latest.published && latest.billReference && (
                <WardBillDetail
                  key={`${selectedWardId}|${latest.termId}`}
                  studentId={selectedWardId}
                  termId={latest.termId}
                />
              )}
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="No bills yet"
              description="Bills appear here once your ward is enrolled for a term."
            />
          )}
        </>
      )}

      {terms && selectedWardId && tab === "past" && (
        <>
          {past.length > 0 ? (
            <div className="space-y-4">
              {page.content.map((term) => (
                <WardFeeTermCard
                  key={term.termId}
                  term={term}
                  canLog={canLog}
                  onLogPayment={() => logPaymentFor(selectedWardId, term)}
                  onViewBill={() => setBillTerm(term)}
                />
              ))}
              {page.totalPages > 1 && <Pagination page={page} onPageChange={setPageIndex} />}
            </div>
          ) : (
            <EmptyState
              icon={Wallet}
              title="No past bills yet"
              description="Older bills will be listed here once there are some."
            />
          )}
        </>
      )}

      <Modal
        open={billTerm !== null}
        onClose={() => setBillTerm(null)}
        title={billTerm ? `${billTerm.termName} bill` : "Bill"}
        size="xl"
      >
        {billTerm && selectedWardId && (
          <WardBillDetail
            key={`${selectedWardId}|${billTerm.termId}`}
            studentId={selectedWardId}
            termId={billTerm.termId}
          />
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
