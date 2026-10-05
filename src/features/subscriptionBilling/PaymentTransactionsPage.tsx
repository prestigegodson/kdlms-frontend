import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  listAdminPaymentTransactions,
  type PaymentTransactionStatus,
  type PaymentTransactionView,
} from "@/api/subscriptionBilling";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { formatMoney, fromMinor } from "@/utils/currency";
import { formatInstant } from "@/utils/date";
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT } from "./paymentStatus";

const PAGE_SIZE = 20;
const STATUSES: PaymentTransactionStatus[] = ["SUCCESS", "PENDING", "FAILED", "ABANDONED"];

type State =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<PaymentTransactionView> }
  | { kind: "error"; message: string };

/** The system admin's view of every tenant's Paystack payments (creators.md §6.1, Phase C8). */
export function PaymentTransactionsPage() {
  const [status, setStatus] = useState<PaymentTransactionStatus | "">("");
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    listAdminPaymentTransactions(status, pageIndex, PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ kind: "loaded", page });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ kind: "error", message: getErrorMessage(error, "Failed to load payments") });
      });
    return () => {
      cancelled = true;
    };
  }, [status, pageIndex]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Plan payments made through Paystack, across every school and creator."
      />

      <StickySubHeader>
        <FormField
          label="Status"
          htmlFor="payment-status"
          className="w-48"
          labelClassName="sr-only lg:not-sr-only"
        >
          <Select
            id="payment-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as PaymentTransactionStatus | "");
              setPageIndex(0);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </FormField>
      </StickySubHeader>

      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={6} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="No payments"
          description={
            status
              ? "No payments have this status."
              : "Payments appear here once a plan is bought online."
          }
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Account</TableHeaderCell>
                  <TableHeaderCell>Plan</TableHeaderCell>
                  <TableHeaderCell numeric>Amount</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Reference</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {state.page.content.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell label="Date">
                      {formatInstant(payment.paidAt ?? payment.createdAt)}
                    </TableCell>
                    <TableCell label="Account" className="font-medium text-slate-900">
                      {payment.schoolName ?? "—"}
                    </TableCell>
                    <TableCell label="Plan">
                      {payment.planName ?? "—"}
                      {payment.purpose === "RENEWAL" && (
                        <span className="ml-1 text-xs text-slate-500">(renewal)</span>
                      )}
                    </TableCell>
                    <TableCell label="Amount" numeric>
                      {formatMoney(fromMinor(payment.amountMinor), payment.currency)}
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]}>
                        {PAYMENT_STATUS_LABEL[payment.status]}
                      </Badge>
                      {payment.status === "FAILED" && payment.gatewayMessage && (
                        <p className="mt-1 text-xs text-slate-500">{payment.gatewayMessage}</p>
                      )}
                    </TableCell>
                    <TableCell label="Reference" className="font-mono text-xs text-slate-500">
                      {payment.reference}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={state.page} onPageChange={setPageIndex} />
        </>
      )}
    </div>
  );
}
