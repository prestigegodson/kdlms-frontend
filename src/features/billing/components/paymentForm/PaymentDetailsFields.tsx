import { useId } from "react";
import { PAYMENT_METHOD_LABELS } from "@/api/feePayments";
import { DateInput } from "@/components/ui/DateInput";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PAYMENT_METHODS, type PaymentDetails } from "@/features/billing/components/paymentForm/paymentDetails";
import { todayIso } from "@/utils/date";

interface PaymentDetailsFieldsProps {
  value: PaymentDetails;
  onChange: (patch: Partial<PaymentDetails>) => void;
}

/**
 * When, how and by whom a fee payment was made (Phase 45, D13) - shared by the guardian's
 * log-payment sheet and the admin's Record payment modal. The method is a grid of radio cards
 * rather than a select, so every option is one tap on a phone.
 */
export function PaymentDetailsFields({ value, onChange }: PaymentDetailsFieldsProps) {
  const id = useId();
  return (
    <div className="space-y-4">
      <FormField label="Payment date" htmlFor={`${id}-date`}>
        <DateInput
          id={`${id}-date`}
          max={todayIso()}
          value={value.paymentDate}
          onChange={(paymentDate) => onChange({ paymentDate })}
        />
      </FormField>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">How did you pay?</legend>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PAYMENT_METHODS.map((method) => {
            const checked = value.method === method;
            return (
              <label
                key={method}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "border-brand-500 bg-brand-50 font-medium text-brand-800"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-method`}
                  value={method}
                  checked={checked}
                  onChange={() => onChange({ method })}
                  className="h-4 w-4 border-slate-300 text-brand-500"
                />
                {PAYMENT_METHOD_LABELS[method]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <FormField label="Payer name" htmlFor={`${id}-payer`} description="The name on the transfer or deposit slip.">
        <Input
          id={`${id}-payer`}
          value={value.payerName}
          maxLength={160}
          autoComplete="name"
          aria-describedby={`${id}-payer-description`}
          onChange={(event) => onChange({ payerName: event.target.value })}
        />
      </FormField>

      <FormField label="Note (optional)" htmlFor={`${id}-note`}>
        <Textarea
          id={`${id}-note`}
          rows={3}
          maxLength={1000}
          value={value.note}
          placeholder="e.g. Paid from my GTBank account"
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </FormField>
    </div>
  );
}
