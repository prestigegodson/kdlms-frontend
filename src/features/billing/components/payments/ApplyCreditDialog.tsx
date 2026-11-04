import { useId, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { creditTermLabel, type Settlement, type StudentCreditView } from "@/api/feePayments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { MoneyInput } from "@/features/billing/components/paymentForm/MoneyInput";
import {
  formatAmountInput,
  parseAmount,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";
import { SettlementToggle } from "@/features/billing/components/payments/SettlementToggle";
import { formatMoney } from "@/utils/currency";

interface ApplyCreditDialogProps {
  wallet: StudentCreditView;
  studentName: string;
  /** Pre-selects this term when it is one of the wallet's targets. */
  defaultTermId?: string;
  onConfirm: (body: {
    targetTermId: string;
    amount: number;
    settlement: Settlement;
    note: string | null;
  }) => Promise<void>;
  onClose: () => void;
}

/**
 * Applying a student's overpayment credit to a term with something left to pay (D10'). The
 * amount defaults to what could go toward the chosen term (the lesser of the wallet and the
 * term's balance); the settlement is suggested from whether it clears the balance (D5).
 */
export function ApplyCreditDialog({
  wallet,
  studentName,
  defaultTermId,
  onConfirm,
  onClose,
}: ApplyCreditDialogProps) {
  const id = useId();
  const initialTarget =
    wallet.targets.find((target) => target.termId === defaultTermId) ?? wallet.targets[0];
  const [targetTermId, setTargetTermId] = useState(initialTarget?.termId ?? "");
  const [amountText, setAmountText] = useState(
    initialTarget ? formatAmountInput(initialTarget.applicable) : "",
  );
  const [chosen, setChosen] = useState<Settlement | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = wallet.targets.find((candidate) => candidate.termId === targetTermId);
  const amountMinor = parseAmount(amountText);
  const maxMinor = target ? toMinorUnits(target.applicable) : 0;
  const tooMuch = amountMinor !== null && amountMinor > maxMinor;
  const suggested: Settlement =
    target && amountMinor !== null && amountMinor >= toMinorUnits(target.balance) ? "FULL" : "PARTIAL";
  const settlement = chosen ?? suggested;
  const valid = target !== undefined && amountMinor !== null && amountMinor > 0 && !tooMuch;

  function chooseTarget(termId: string) {
    setTargetTermId(termId);
    const next = wallet.targets.find((candidate) => candidate.termId === termId);
    if (next) setAmountText(formatAmountInput(next.applicable));
    setChosen(null);
  }

  async function confirm() {
    if (!valid || !target) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        targetTermId: target.termId,
        amount: amountMinor / 100,
        settlement,
        note: note.trim() === "" ? null : note.trim(),
      });
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't apply the credit"));
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={() => !submitting && onClose()} title="Apply credit" size="md">
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-slate-700">
          {studentName} has {formatMoney(wallet.available, wallet.currency)} in credit from overpaid
          terms. It's used oldest term first.
        </p>
        <FormField label="Apply to" htmlFor={`${id}-term`}>
          <Select
            id={`${id}-term`}
            value={targetTermId}
            onChange={(event) => chooseTarget(event.target.value)}
          >
            {wallet.targets.map((candidate) => (
              <option key={candidate.termId} value={candidate.termId}>
                {creditTermLabel(candidate.termName, candidate.sessionName)} - owes{" "}
                {formatMoney(candidate.balance, wallet.currency)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Amount"
          htmlFor={`${id}-amount`}
          error={tooMuch ? "That's more than can be applied to this term." : undefined}
        >
          <MoneyInput
            id={`${id}-amount`}
            currency={wallet.currency}
            value={amountText}
            aria-invalid={(amountText.trim() !== "" && amountMinor === null) || tooMuch ? true : undefined}
            onChange={(event) => setAmountText(event.target.value)}
          />
          {target && (
            <p className="mt-1 text-xs text-slate-500">
              Up to {formatMoney(target.applicable, wallet.currency)}
            </p>
          )}
        </FormField>
        <SettlementToggle value={settlement} onChange={setChosen} suggested={suggested} hasBill />
        <FormField label="Note (optional)" htmlFor={`${id}-note`}>
          <Textarea
            id={`${id}-note`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={confirm} loading={submitting} disabled={!valid} className="w-full sm:w-auto">
            Apply credit
          </Button>
        </div>
      </div>
    </Modal>
  );
}
