import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Receipt, Wallet } from "lucide-react";
import {
  getWardFees,
  getWardOtherPayments,
  withdrawFeePayment,
  type AllocationStatus,
  type WardFeePaymentView,
} from "@/api/feePayments";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import {
  LogOtherPaymentSheet,
  type LogOtherPaymentIntent,
} from "@/features/guardian/components/LogOtherPaymentSheet";
import { LogPaymentSheet, type LogPaymentIntent } from "@/features/guardian/components/LogPaymentSheet";
import { PAYMENT_STATUS_BADGES } from "@/features/guardian/components/paymentStatus";
import { WardPaymentsTable, type WardPaymentRowData } from "@/features/guardian/components/WardPaymentsTable";
import { usePageParam } from "@/hooks/usePageParam";
import { useFeatureStore } from "@/stores/featureStore";
import { useWardStore } from "@/stores/wardStore";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";
import { paginate } from "@/utils/paginate";

const PAYMENTS_PER_PAGE = 20;

const STATUS_FILTERS: AllocationStatus[] = ["PENDING", "CONFIRMED", "REJECTED", "WITHDRAWN", "VOIDED"];

/**
 * Every fee payment across all of the guardian's wards, in one table (split out of Phase 45G's
 * merged Fees page; the bills themselves stay on `WardBillsPage`). There's no guardian-wide
 * payments endpoint - each ward's `GET /api/v1/me/wards/{id}/fees` already carries its payments
 * and the term a payment's Edit/Resubmit needs, and `.../other-payments` its "other" payments
 * (D24: an excursion, the Christmas party - no term card, since they settle no bill) - so this
 * fetches both for every ward in parallel and flattens. `allSettled`, so one ward whose school isn't entitled to Billing (or a transient
 * failure) never blanks the rest, just raises a warning. The merged, filtered rows are paged
 * client-side (`paginate`, `?page=` via `usePageParam`) since they already arrive whole.
 */
export function WardPaymentsPage() {
  const { wards, status, errorMessage: wardsError, fetchIfNeeded, retry } = useWardStore();
  const billingEntitled = useFeatureStore((state) => state.billing);
  const canLog = can.logWardPayment("GUARDIAN", billingEntitled);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [rows, setRows] = useState<WardPaymentRowData[] | null>(null);
  const [failedWards, setFailedWards] = useState<string[]>([]);
  // What the log-other-payment sheet reads: each ward's own other payments, and each school's currency.
  const [otherByStudent, setOtherByStudent] = useState<Map<string, WardFeePaymentView[]>>(new Map());
  const [currencyBySchool, setCurrencyBySchool] = useState<Map<string, string>>(new Map());
  // Guards against an older refetch resolving after a newer one.
  const requestId = useRef(0);

  const loadPayments = useCallback(() => {
    if (status !== "loaded" || wards.length === 0) return;
    const id = ++requestId.current;
    Promise.allSettled(
      wards.map((ward) => Promise.all([getWardFees(ward.studentId), getWardOtherPayments(ward.studentId)])),
    ).then((results) => {
      if (id !== requestId.current) return;
      const loaded: WardPaymentRowData[] = [];
      const failed: string[] = [];
      const others = new Map<string, WardFeePaymentView[]>();
      const currencies = new Map<string, string>();
      results.forEach((result, index) => {
        const ward = wards[index];
        if (result.status === "rejected") {
          failed.push(ward.fullName);
          return;
        }
        const [terms, other] = result.value;
        currencies.set(ward.schoolId, other.currency);
        for (const term of terms) {
          for (const payment of term.payments) loaded.push({ ward, term, payment, currency: term.currency });
        }
        others.set(ward.studentId, other.payments);
        for (const payment of other.payments) loaded.push({ ward, term: null, payment, currency: other.currency });
      });
      loaded.sort(
        (a, b) =>
          b.payment.paymentDate.localeCompare(a.payment.paymentDate) ||
          b.payment.submittedAt.localeCompare(a.payment.submittedAt),
      );
      setRows(loaded);
      setFailedWards(failed);
      setOtherByStudent(others);
      setCurrencyBySchool(currencies);
    });
  }, [status, wards]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // ----- Filters -----
  const [childFilter, setChildFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AllocationStatus | "">("");
  const visibleRows = useMemo(
    () =>
      (rows ?? []).filter(
        (row) =>
          (!childFilter || row.ward.studentId === childFilter) && (!statusFilter || row.payment.status === statusFilter),
      ),
    [rows, childFilter, statusFilter],
  );
  const [pageIndex, setPageIndex] = usePageParam();
  const page = paginate(visibleRows, pageIndex, PAYMENTS_PER_PAGE);
  const multiSchool = new Set(wards.map((ward) => ward.schoolId)).size > 1;

  // ----- Log / edit / resubmit / withdraw -----
  const [formIntent, setFormIntent] = useState<LogPaymentIntent | null>(null);
  const [otherIntent, setOtherIntent] = useState<LogOtherPaymentIntent | null>(null);
  const [withdrawing, setWithdrawing] = useState<WardPaymentRowData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirmWithdraw() {
    if (!withdrawing) return;
    await withdrawFeePayment(withdrawing.payment.paymentId);
    setWithdrawing(null);
    setNotice("Payment withdrawn.");
    loadPayments();
  }

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Every payment logged for your wards - school fees and anything else - and its status."
        actions={
          hasWards &&
          canLog && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setNotice(null);
                  setOtherIntent({ kind: "new" });
                }}
              >
                <Receipt className="h-4 w-4" aria-hidden="true" /> Log other payment
              </Button>
              <Button
                onClick={() => {
                  setNotice(null);
                  setFormIntent({ kind: "open" });
                }}
              >
                <Wallet className="h-4 w-4" aria-hidden="true" /> Log payment
              </Button>
            </>
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

      {hasWards && rows !== null && rows.length > 0 && (
        <StickySubHeader>
          {wards.length > 1 && (
            <FormField label="Child" htmlFor="payments-child" className="min-w-0 flex-1 lg:max-w-xs lg:flex-initial">
              <Select id="payments-child" value={childFilter} onChange={(event) => {
                  setChildFilter(event.target.value);
                  setPageIndex(0);
                }}>
                <option value="">All children</option>
                {wards.map((ward) => (
                  <option key={ward.studentId} value={ward.studentId}>
                    {multiSchool ? `${ward.fullName} — ${ward.schoolName}` : ward.fullName}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Status" htmlFor="payments-status" className="min-w-0 flex-1 lg:max-w-xs lg:flex-initial">
            <Select
              id="payments-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as AllocationStatus | "");
                setPageIndex(0);
              }}
            >
              <option value="">All statuses</option>
              {STATUS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_STATUS_BADGES[value].label}
                </option>
              ))}
            </Select>
          </FormField>
        </StickySubHeader>
      )}

      {notice && <Alert variant="success">{notice}</Alert>}
      {failedWards.length > 0 && (
        <Alert variant="warning">Couldn't load payments for {failedWards.join(", ")}.</Alert>
      )}

      {hasWards && rows === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading payments…
        </div>
      )}

      {rows !== null && rows.length === 0 && failedWards.length < wards.length && (
        <EmptyState
          icon={Wallet}
          title="No payments yet"
          description="Payments you log for your wards' fees, excursions and other school costs appear here, with their receipts once confirmed."
        />
      )}

      {rows !== null && rows.length > 0 && visibleRows.length === 0 && (
        <p className="text-sm text-slate-500">No payments match these filters.</p>
      )}

      {visibleRows.length > 0 && (
        <WardPaymentsTable
          rows={page.content}
          showSchool={multiSchool}
          onEdit={(row) => {
            setNotice(null);
            if (row.term) {
              setFormIntent({ kind: "edit", studentId: row.ward.studentId, term: row.term, payment: row.payment });
            } else {
              setOtherIntent({ kind: "edit", studentId: row.ward.studentId, payment: row.payment });
            }
          }}
          onWithdraw={(row) => {
            setNotice(null);
            setWithdrawing(row);
          }}
          onResubmit={(row) => {
            setNotice(null);
            if (row.term) {
              setFormIntent({ kind: "resubmit", studentId: row.ward.studentId, term: row.term, payment: row.payment });
            } else {
              setOtherIntent({ kind: "resubmit", studentId: row.ward.studentId, payment: row.payment });
            }
          }}
        />
      )}
      {page.totalPages > 1 && <Pagination page={page} onPageChange={setPageIndex} />}

      <LogPaymentSheet
        intent={formIntent}
        wards={wards}
        onClose={() => setFormIntent(null)}
        onSubmitted={(message) => {
          setFormIntent(null);
          setNotice(message);
          loadPayments();
        }}
      />

      <LogOtherPaymentSheet
        intent={otherIntent}
        wards={wards}
        paymentsByStudent={otherByStudent}
        currencyBySchool={currencyBySchool}
        onClose={() => setOtherIntent(null)}
        onSubmitted={(message) => {
          setOtherIntent(null);
          setNotice(message);
          loadPayments();
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
