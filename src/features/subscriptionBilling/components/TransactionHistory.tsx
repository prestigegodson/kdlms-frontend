import { Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { listPaymentTransactions, type PaymentTransactionView } from "@/api/subscriptionBilling";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
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
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_VARIANT } from "../paymentStatus";

const PAGE_SIZE = 10;

type State =
  | { kind: "loading" }
  | { kind: "loaded"; page: Page<PaymentTransactionView> }
  | { kind: "error"; message: string };

/** The tenant's own Paystack payments, newest first (creators.md §6.1). */
export function TransactionHistory() {
  const [pageIndex, setPageIndex] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    listPaymentTransactions(pageIndex, PAGE_SIZE)
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
  }, [pageIndex]);

  return (
    <section aria-labelledby="payment-history-heading" className="space-y-3">
      <h2 id="payment-history-heading" className="text-base font-semibold text-slate-900">
        Payment history
      </h2>
      {state.kind === "loading" && (
        <Card className="p-0">
          <TableSkeleton columns={4} />
        </Card>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}
      {state.kind === "loaded" && state.page.content.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="No payments yet"
          description="Your card payments will appear here."
        />
      )}
      {state.kind === "loaded" && state.page.content.length > 0 && (
        <>
          <Card className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
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
                    <TableCell label="Plan">
                      {payment.planName ?? "—"}
                      {payment.purpose === "RENEWAL" && (
                        <span className="ml-1 text-xs text-slate-500">(renewal)</span>
                      )}
                    </TableCell>
                    <TableCell label="Amount" numeric>
                      {formatMoney(fromMinor(payment.amountMinor), payment.currency)}
                      {payment.discountMinor > 0 && (
                        <span className="block text-xs text-slate-500">
                          {payment.couponCode ? `${payment.couponCode}: ` : "Coupon: "}−
                          {formatMoney(fromMinor(payment.discountMinor), payment.currency)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell label="Status">
                      <Badge variant={PAYMENT_STATUS_VARIANT[payment.status]}>
                        {PAYMENT_STATUS_LABEL[payment.status]}
                      </Badge>
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
    </section>
  );
}
