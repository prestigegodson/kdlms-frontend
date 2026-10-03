import { useId } from "react";
import { Alert } from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/Checkbox";
import { MoneyInput } from "@/features/billing/components/paymentForm/MoneyInput";
import { parseAmount } from "@/features/billing/components/paymentForm/paymentAmounts";
import {
  type ChildDrafts,
  MAX_PAYMENT_CHILDREN,
  type PaymentChildOption,
  selectedOptions,
  totalMinor,
} from "@/features/billing/components/paymentForm/paymentChildren";
import { formatMoney } from "@/utils/currency";

interface ChildrenAmountsStepProps {
  options: PaymentChildOption[];
  drafts: ChildDrafts;
  currency: string;
  onToggle: (option: PaymentChildOption) => void;
  onAmountChange: (studentId: string, amountText: string) => void;
  /** The step's lead-in sentence - defaults to the guardian's wording. */
  intro?: string;
  /** The hint for a child with no bill (amount-only, D2) - defaults to the guardian's wording. */
  noBillHint?: string;
}

function groupByLabel(options: PaymentChildOption[]): [string, PaymentChildOption[]][] {
  const groups = new Map<string, PaymentChildOption[]>();
  for (const option of options) {
    const group = groups.get(option.groupLabel);
    if (group) {
      group.push(option);
    } else {
      groups.set(option.groupLabel, [option]);
    }
  }
  return [...groups.entries()];
}

function balanceHint(option: PaymentChildOption, currency: string, noBillHint: string): string {
  if (option.balance == null) {
    return noBillHint;
  }
  if (option.balance < 0) {
    return `In credit by ${formatMoney(Math.abs(option.balance), currency)}`;
  }
  return `Left to pay ${formatMoney((option.outstandingMinor ?? 0) / 100, currency)}`;
}

/**
 * Step 1 of a fee-payment form (D3): which children one payment covered, and how much of it was
 * for each - the guardian's log-payment sheet (45H) and the admin's Record payment modal (45I).
 * A row the caller marks disabled is shown with its reason rather than hidden. Paying more than
 * what's left is allowed, with a warning (D10).
 */
export function ChildrenAmountsStep({
  options,
  drafts,
  currency,
  onToggle,
  onAmountChange,
  intro = "Tick each child this payment was for, and enter how much of it was for them.",
  noBillHint = "No bill yet — enter the amount you paid",
}: ChildrenAmountsStepProps) {
  const id = useId();
  const groups = groupByLabel(options);
  const selectedCount = selectedOptions(options, drafts).length;
  const atLimit = selectedCount >= MAX_PAYMENT_CHILDREN;
  const total = totalMinor(options, drafts);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">{intro}</p>

      {groups.map(([groupLabel, groupOptions]) => (
        <section key={groupLabel} className="space-y-2">
          {groups.length > 1 && (
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {groupLabel}
            </h3>
          )}
          <ul className="space-y-2">
            {groupOptions.map((option) => {
              const draft = drafts[option.studentId];
              const selected = option.disabledReason === null && !!draft?.selected;
              const disabled = option.disabledReason !== null || (!selected && atLimit);
              const amountMinor = selected ? parseAmount(draft.amountText) : null;
              const amountInvalid =
                selected && draft.amountText.trim() !== "" && amountMinor === null;
              const overpaying =
                amountMinor !== null &&
                option.outstandingMinor !== null &&
                amountMinor > option.outstandingMinor;
              const inputId = `${id}-${option.studentId}`;
              return (
                <li
                  key={option.studentId}
                  className={`rounded-control border p-3 ${
                    selected ? "border-brand-300 bg-brand-50/40" : "border-slate-200"
                  } ${option.disabledReason ? "bg-slate-50" : ""}`}
                >
                  <label
                    className={`flex min-h-11 items-center gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={disabled}
                      onChange={() => onToggle(option)}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block break-words text-sm font-medium ${disabled ? "text-slate-500" : "text-slate-900"}`}
                      >
                        {option.name}
                      </span>
                      <span
                        className={`block text-xs ${option.warning ? "text-amber-700" : "text-slate-500"}`}
                      >
                        {option.disabledReason ??
                          option.warning ??
                          balanceHint(option, currency, noBillHint)}
                      </span>
                    </span>
                  </label>
                  {selected && (
                    <div className="mt-2 pl-7">
                      <label htmlFor={inputId} className="sr-only">
                        Amount for {option.name}
                      </label>
                      <MoneyInput
                        id={inputId}
                        currency={currency}
                        value={draft.amountText}
                        placeholder="0.00"
                        aria-invalid={amountInvalid || undefined}
                        onChange={(event) => onAmountChange(option.studentId, event.target.value)}
                      />
                      {amountInvalid && (
                        <p className="mt-1 text-sm text-red-600">
                          Enter an amount above zero, with at most two decimal places.
                        </p>
                      )}
                      {overpaying && (
                        <p className="mt-1 text-sm text-amber-700">
                          More than what's left to pay — the extra will show as a credit for this
                          term.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {atLimit && (
        <Alert variant="info">A payment can cover at most {MAX_PAYMENT_CHILDREN} children.</Alert>
      )}

      <div className="flex items-baseline justify-between border-t border-slate-200 pt-3">
        <span className="text-sm font-medium text-slate-700">Total paid</span>
        <span
          className="text-lg font-semibold text-slate-900"
          aria-live="polite"
          data-testid="payment-total"
        >
          {formatMoney(total / 100, currency)}
        </span>
      </div>
    </div>
  );
}
