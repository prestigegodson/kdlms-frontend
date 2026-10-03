import { Link } from "react-router";
import type { WardFeeTermView } from "@/api/feePayments";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TermPaymentStatusBadge } from "@/features/billing/components/TermPaymentStatusBadge";
import { formatMoney } from "@/utils/currency";

interface WardFeeTermCardProps {
  term: WardFeeTermView;
  /** `can.logWardPayment` - the role/entitlement half; the term's own `canLogPayment` is the paid-in-full half. */
  canLog: boolean;
  onLogPayment: () => void;
  onViewBill: () => void;
}

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`text-lg font-semibold sm:mt-0.5 ${emphasis ? "text-slate-900" : "text-slate-700"}`}>{value}</dd>
    </div>
  );
}

/**
 * One term on the guardian Bills page (Phase 45G) - billed / paid / balance at a glance and the
 * actions to log a payment or open the bill. The term's payment history itself lives on the
 * Payments page (a table across every ward), linked from here. A term with no
 * published, billable bill still gets a card (payments against it are amount-only), with "No bill"
 * in place of the billed and balance figures; a negative balance reads as a credit.
 */
export function WardFeeTermCard({ term, canLog, onLogPayment, onViewBill }: WardFeeTermCardProps) {
  const hasBill = term.billed != null;
  const balanceLabel = term.balance != null && term.balance < 0 ? "Credit" : "Balance";
  const balanceValue = term.balance == null ? "No bill" : formatMoney(Math.abs(term.balance), term.currency);
  const showLog = canLog && term.canLogPayment;
  const showViewBill = term.published && !!term.billReference;

  return (
    <Card className="space-y-4" aria-label={`${term.termName}, ${term.sessionName}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">{term.termName}</h2>
          <p className="text-sm text-slate-500">{term.sessionName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {term.current && <Badge variant="brand">Current</Badge>}
          {term.advance && <Badge>Advance</Badge>}
          <TermPaymentStatusBadge status={term.status} hasPending={term.hasPending} inCredit={term.inCredit} />
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
        <Figure label="Billed" value={hasBill ? formatMoney(term.billed, term.currency) : "No bill"} />
        <Figure label="Paid" value={formatMoney(term.confirmedPaid, term.currency)} />
        <Figure label={balanceLabel} value={balanceValue} emphasis />
      </dl>

      {term.pendingAmount > 0 && (
        <p className="text-sm text-blue-700">{formatMoney(term.pendingAmount, term.currency)} pending confirmation</p>
      )}

      {(showLog || showViewBill) && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {showLog && (
            <Button className="min-h-11 w-full sm:w-auto" onClick={onLogPayment}>
              Log payment
            </Button>
          )}
          {showViewBill && (
            <Button variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={onViewBill}>
              View bill
            </Button>
          )}
        </div>
      )}

      {term.payments.length > 0 && (
        <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
          {term.payments.length} {term.payments.length === 1 ? "payment" : "payments"} logged for this term ·{" "}
          <Link to="/guardian/payments" className="font-medium text-brand-700 hover:underline">
            View payments
          </Link>
        </p>
      )}
    </Card>
  );
}
