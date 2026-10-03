import { PAYMENT_METHOD_LABELS } from "@/api/feePayments";
import type { PaymentDetails } from "@/features/billing/components/paymentForm/paymentDetails";
import { parseAmount } from "@/features/billing/components/paymentForm/paymentAmounts";
import type {
  ChildDrafts,
  PaymentChildOption,
} from "@/features/billing/components/paymentForm/paymentChildren";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

interface ReviewSummaryProps {
  termLabel: string;
  /** The ticked children. */
  options: PaymentChildOption[];
  drafts: ChildDrafts;
  details: PaymentDetails;
  totalMinor: number;
  currency: string;
}

/** What's about to be sent, at a glance - the last thing checked before Submit (guardian sheet and admin Record payment alike). */
export function ReviewSummary({
  termLabel,
  options,
  drafts,
  details,
  totalMinor,
  currency,
}: ReviewSummaryProps) {
  return (
    <section
      aria-label="Payment summary"
      className="space-y-3 rounded-control border border-slate-200 bg-slate-50 p-3"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{termLabel}</p>
      <ul className="space-y-2">
        {options.map((option) => {
          const draft = drafts[option.studentId];
          const fees = option.optionalFees.filter((fee) =>
            draft.optionalFeeIds.includes(fee.feeId),
          );
          return (
            <li key={option.studentId} className="text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-slate-800">{option.name}</span>
                <span className="font-medium text-slate-900">
                  {formatMoney((parseAmount(draft.amountText) ?? 0) / 100, currency)}
                </span>
              </div>
              {fees.length > 0 && (
                <p className="text-xs text-slate-500">
                  Includes {fees.map((fee) => fee.feeName).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
        <span className="text-sm font-medium text-slate-700">Total</span>
        <span className="text-base font-semibold text-slate-900">
          {formatMoney(totalMinor / 100, currency)}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">Paid on</dt>
        <dd className="text-slate-800">{formatLongDate(details.paymentDate)}</dd>
        <dt className="text-slate-500">Method</dt>
        <dd className="text-slate-800">
          {details.method ? PAYMENT_METHOD_LABELS[details.method] : "—"}
        </dd>
        <dt className="text-slate-500">Payer</dt>
        <dd className="break-words text-slate-800">{details.payerName.trim()}</dd>
        {details.note.trim() && (
          <>
            <dt className="text-slate-500">Note</dt>
            <dd className="break-words text-slate-800">{details.note.trim()}</dd>
          </>
        )}
      </dl>
    </section>
  );
}
