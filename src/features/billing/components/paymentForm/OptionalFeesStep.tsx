import { Checkbox } from "@/components/ui/Checkbox";
import type {
  ChildDrafts,
  PaymentChildOption,
} from "@/features/billing/components/paymentForm/paymentChildren";
import { formatMoney } from "@/utils/currency";

interface OptionalFeesStepProps {
  /** The ticked children - only those with an unselected optional fee are listed. */
  options: PaymentChildOption[];
  drafts: ChildDrafts;
  currency: string;
  onToggleFee: (studentId: string, feeId: string) => void;
}

/**
 * Step 2 of a fee-payment form (D8): the optional fees on each ticked child's bill that aren't on
 * it yet (e.g. an excursion). Ticking one says this payment covered it - once the payment is
 * confirmed it's added to the child's bill. Skipped entirely when no ticked child has one.
 */
export function OptionalFeesStep({
  options,
  drafts,
  currency,
  onToggleFee,
}: OptionalFeesStepProps) {
  const withFees = options.filter((option) => option.optionalFees.length > 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Tick only the optional fees this payment covers. Make sure they're included in the amount
        you entered.
      </p>
      {withFees.map((option) => {
        const ticked = new Set(drafts[option.studentId]?.optionalFeeIds ?? []);
        return (
          <fieldset key={option.studentId} className="space-y-1">
            <legend className="text-sm font-medium text-slate-900">{option.name}</legend>
            {option.optionalFees.map((fee) => (
              <label
                key={fee.feeId}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-slate-200 px-3 py-2"
              >
                <Checkbox
                  checked={ticked.has(fee.feeId)}
                  onChange={() => onToggleFee(option.studentId, fee.feeId)}
                />
                <span className="flex-1 text-sm text-slate-800">{fee.feeName}</span>
                <span className="text-sm font-medium text-slate-700">
                  {formatMoney(fee.amount, currency)}
                </span>
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
