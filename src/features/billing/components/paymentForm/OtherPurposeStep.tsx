import { useId } from "react";
import type { OtherPaymentItemView } from "@/api/feePayments";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import {
  MAX_PURPOSE_LABEL_LENGTH,
  type PurposeDraft,
} from "@/features/billing/components/paymentForm/otherPurpose";
import { formatMoney } from "@/utils/currency";

interface OtherPurposeStepProps {
  items: OtherPaymentItemView[];
  value: PurposeDraft;
  currency: string;
  onChange: (value: PurposeDraft) => void;
  /** The question above the choices - defaults to the guardian's wording. */
  legend?: string;
}

/**
 * What an "other" payment (D24) is for - one of the school's items (an excursion, the Christmas
 * party), each a radio card showing its suggested amount, or "Something else" with a free-text
 * label. Shared by the guardian's log-other-payment sheet and the admin's Record payment modal,
 * the `PaymentDetailsFields` radio-card idiom.
 */
export function OtherPurposeStep({
  items,
  value,
  currency,
  onChange,
  legend = "What is this payment for?",
}: OtherPurposeStepProps) {
  const id = useId();
  const custom = value.choice === "custom";
  const cardClass = (checked: boolean) =>
    `flex min-h-11 cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 text-sm transition-colors ${
      checked ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">{legend}</legend>
        <div className="mt-1 space-y-2">
          {items.map((item) => {
            const checked = value.choice === item.id;
            return (
              <label key={item.id} className={cardClass(checked)}>
                <input
                  type="radio"
                  name={`${id}-purpose`}
                  value={item.id}
                  checked={checked}
                  onChange={() => onChange({ choice: item.id, label: "" })}
                  className="mt-0.5 h-4 w-4 border-slate-300 text-brand-500"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block break-words ${checked ? "font-medium text-brand-800" : "text-slate-800"}`}
                  >
                    {item.name}
                  </span>
                  {item.amount != null && (
                    <span className="block text-xs text-slate-500">
                      {formatMoney(item.amount, currency)} per child
                    </span>
                  )}
                </span>
              </label>
            );
          })}
          <label className={cardClass(custom)}>
            <input
              type="radio"
              name={`${id}-purpose`}
              value="custom"
              checked={custom}
              onChange={() => onChange({ choice: "custom", label: value.label })}
              className="mt-0.5 h-4 w-4 border-slate-300 text-brand-500"
            />
            <span className={custom ? "font-medium text-brand-800" : "text-slate-800"}>
              Something else
            </span>
          </label>
        </div>
      </fieldset>

      {custom && (
        <FormField label="Describe what you paid for" htmlFor={`${id}-label`}>
          <Input
            id={`${id}-label`}
            value={value.label}
            maxLength={MAX_PURPOSE_LABEL_LENGTH}
            placeholder="e.g. Excursion to the zoo"
            autoFocus
            onChange={(event) => onChange({ choice: "custom", label: event.target.value })}
          />
        </FormField>
      )}
    </div>
  );
}
