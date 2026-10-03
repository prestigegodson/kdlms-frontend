import { useId, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { Settlement } from "@/api/feePayments";
import type { AllocationView } from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { MoneyInput } from "@/features/billing/components/paymentForm/MoneyInput";
import {
  formatAmountInput,
  parseAmount,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";
import { SettlementToggle } from "@/features/billing/components/payments/SettlementToggle";
import { suggestSettlement } from "@/features/billing/components/payments/reviewDraft";
import { formatMoney } from "@/utils/currency";

interface CorrectAmountDialogProps {
  allocation: AllocationView;
  currency: string;
  onConfirm: (body: { amount: number; settlement: Settlement; reason: string }) => Promise<void>;
  onClose: () => void;
}

/**
 * Correcting a confirmed child's amount (D11) - voids its receipt and issues a new number. The
 * settlement suggestion counts the term's other confirmed payments plus the corrected amount.
 */
export function CorrectAmountDialog({
  allocation,
  currency,
  onConfirm,
  onClose,
}: CorrectAmountDialogProps) {
  const id = useId();
  const [amountText, setAmountText] = useState(
    formatAmountInput(allocation.confirmedAmount ?? allocation.claimedAmount),
  );
  const [chosen, setChosen] = useState<Settlement | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountMinor = parseAmount(amountText);
  const billMinor = allocation.bill ? toMinorUnits(allocation.bill.total) : null;
  const otherConfirmed =
    toMinorUnits(allocation.termStatus.confirmedPaid) -
    toMinorUnits(allocation.confirmedAmount ?? 0);
  const suggested = suggestSettlement(billMinor, otherConfirmed + (amountMinor ?? 0));
  const settlement = chosen ?? suggested;
  const valid = amountMinor !== null && reason.trim() !== "";

  async function confirm() {
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({ amount: amountMinor / 100, settlement, reason: reason.trim() });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't correct the amount"));
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={() => !submitting && onClose()} title="Correct amount" size="md">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-700">
          {allocation.studentName} - currently {formatMoney(allocation.confirmedAmount, currency)}.
          The current receipt will be voided and a new one issued.
        </p>
        <FormField label="Corrected amount" htmlFor={`${id}-amount`}>
          <MoneyInput
            id={`${id}-amount`}
            currency={currency}
            value={amountText}
            aria-invalid={amountText.trim() !== "" && amountMinor === null ? true : undefined}
            onChange={(event) => setAmountText(event.target.value)}
          />
        </FormField>
        <SettlementToggle
          value={settlement}
          onChange={setChosen}
          suggested={suggested}
          hasBill={billMinor !== null}
        />
        <FormField label="Reason" htmlFor={`${id}-reason`}>
          <Textarea
            id={`${id}-reason`}
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={confirm}
            loading={submitting}
            disabled={!valid}
            className="w-full sm:w-auto"
          >
            Correct amount
          </Button>
        </div>
      </div>
    </Modal>
  );
}
