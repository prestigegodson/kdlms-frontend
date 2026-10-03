import { Download, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type AllocationStatus,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
} from "@/api/feePayments";
import {
  type CollectionSummaryView,
  exportFeePaymentsCsv,
  getCollectionSummary,
  listFeePayments,
  type PaymentQueueFilters,
  type PaymentQueuePage,
} from "@/api/staffFeePayments";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { LevelTermPicker } from "@/features/billing/components/LevelTermPicker";
import { PAYMENT_METHODS } from "@/features/billing/components/paymentForm/paymentDetails";
import { CollectionSummaryStrip } from "@/features/billing/components/payments/CollectionSummaryStrip";
import { ALLOCATION_STATUS_LABELS } from "@/features/billing/components/payments/paymentLabels";
import { PaymentQueueTable } from "@/features/billing/components/payments/PaymentQueueTable";
import { PaymentReviewModal } from "@/features/billing/components/payments/PaymentReviewModal";
import {
  RecordPaymentModal,
  type RecordPaymentTarget,
} from "@/features/billing/components/payments/RecordPaymentModal";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { downloadBlob } from "@/utils/download";

const PAGE_SIZE = 20;
const STATUSES: AllocationStatus[] = ["PENDING", "CONFIRMED", "REJECTED", "VOIDED", "WITHDRAWN"];

/**
 * The fee-payments review queue (Phase 45I, D23): branch + class + term filters plus status,
 * method, date range and a student/payer search; a collection summary for the branch + term; CSV
 * export with the same filters; and Record payment. Opens on the pending queue, since reviewing is
 * this tab's everyday job.
 */
export function PaymentsTab() {
  const { ready: branchReady, branchId } = useBranchScope();
  const role = useAuthStore((state) => state.user?.role);
  const showBranch = can.selectBranch(role);

  const [levelId, setLevelId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [status, setStatus] = useState<AllocationStatus | "">("PENDING");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [queue, setQueue] = useState<PaymentQueuePage | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CollectionSummaryView | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [recordTarget, setRecordTarget] = useState<RecordPaymentTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const trimmedQ = q.trim();
  const filters: PaymentQueueFilters = {
    branchId,
    termId: termId || undefined,
    levelId: levelId || undefined,
    status: status || undefined,
    method: method || undefined,
    from: from || undefined,
    to: to || undefined,
    // The backend ignores a 1-character search; so does the queue, rather than flashing every row.
    q: trimmedQ.length >= 2 ? trimmedQ : undefined,
  };
  const filterKey = JSON.stringify(filters);

  // Any filter change goes back to the first page (reset during render, the BillsTab idiom).
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(0);
    setQueue(null);
  }

  useEffect(() => {
    if (!branchReady) return;
    let cancelled = false;
    listFeePayments(JSON.parse(filterKey) as PaymentQueueFilters, page, PAGE_SIZE)
      .then((next) => {
        if (cancelled) return;
        setQueue(next);
        setQueueError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setQueueError(getErrorMessage(error, "Couldn't load payments"));
      });
    return () => {
      cancelled = true;
    };
  }, [branchReady, filterKey, page, refreshKey]);

  useEffect(() => {
    if (!branchReady || !termId) return;
    let cancelled = false;
    getCollectionSummary(termId, branchId)
      .then((next) => {
        if (cancelled) return;
        setSummary(next);
        setSummaryError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setSummaryError(getErrorMessage(error, "Couldn't load the collection summary"));
      });
    return () => {
      cancelled = true;
    };
  }, [branchReady, termId, branchId, refreshKey]);

  function refresh() {
    setRefreshKey((n) => n + 1);
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      downloadBlob(await exportFeePaymentsCsv(filters), "fee-payments.csv");
    } catch (error) {
      setExportError(getErrorMessage(error, "Couldn't export payments"));
    } finally {
      setExporting(false);
    }
  }

  // A summary left over from a previous term/branch is never shown or used for Record payment.
  const summaryMatchesTerm =
    summary !== null &&
    summary.termId === termId &&
    (branchId === undefined || summary.branchId === branchId);

  return (
    <div className="space-y-6">
      {!branchReady ? (
        <Skeleton className="h-10 w-full" />
      ) : (
        <StickySubHeader collapsible>
          <BranchFilter id="payments-branch" />
          <LevelTermPicker
            levelId={levelId}
            onLevelChange={setLevelId}
            sessionId={sessionId}
            onSessionChange={setSessionId}
            termId={termId}
            onTermChange={setTermId}
            defaultCurrentSession
            levelPlaceholder="All classes"
            idPrefix="payments"
          />
        </StickySubHeader>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        <FormField label="Status" htmlFor="payments-status">
          <Select
            id="payments-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AllocationStatus | "")}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {ALLOCATION_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Method" htmlFor="payments-method">
          <Select
            id="payments-method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod | "")}
          >
            <option value="">All methods</option>
            {PAYMENT_METHODS.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_METHOD_LABELS[value]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Paid from" htmlFor="payments-from">
          <DateInput id="payments-from" value={from} onChange={setFrom} max={to || undefined} />
        </FormField>
        <FormField label="Paid to" htmlFor="payments-to">
          <DateInput id="payments-to" value={to} onChange={setTo} min={from || undefined} />
        </FormField>
        <FormField label="Search" htmlFor="payments-search">
          <SearchInput
            id="payments-search"
            value={q}
            onChange={setQ}
            placeholder="Student, admission no. or payer"
          />
        </FormField>
      </div>

      {termId && (
        <CollectionSummaryStrip
          summary={summaryMatchesTerm ? summary : null}
          error={summaryError}
        />
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={exportCsv} loading={exporting}>
          <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
        </Button>
        <Button
          onClick={() =>
            summaryMatchesTerm &&
            setRecordTarget({
              termId,
              termLabel: summary.termName,
              currency: summary.currency,
              branchId,
            })
          }
          disabled={!summaryMatchesTerm}
          title={summaryMatchesTerm ? undefined : "Pick a term first"}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Record payment
        </Button>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {exportError && <Alert variant="error">{exportError}</Alert>}
      {queueError && <Alert variant="error">{queueError}</Alert>}

      {queue === null ? (
        !queueError && (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )
      ) : queue.items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={
            status === "PENDING" ? "Nothing waiting for review" : "No payments match these filters"
          }
        />
      ) : (
        <>
          <PaymentQueueTable
            items={queue.items}
            showBranch={showBranch && !branchId}
            onOpen={setReviewingId}
          />
          <Pagination
            page={{
              content: queue.items,
              totalElements: queue.totalElements,
              totalPages: queue.totalPages,
              number: queue.page,
              size: queue.size,
            }}
            onPageChange={setPage}
          />
        </>
      )}

      <PaymentReviewModal
        paymentId={reviewingId}
        onClose={() => setReviewingId(null)}
        onChanged={refresh}
      />
      <RecordPaymentModal
        target={recordTarget}
        onClose={() => setRecordTarget(null)}
        onRecorded={(message) => {
          setRecordTarget(null);
          setNotice(message);
          refresh();
        }}
      />
    </div>
  );
}
