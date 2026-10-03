import { useId } from "react";
import type { AllocationView } from "@/api/staffFeePayments";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Textarea";
import { TermPaymentStatusBadge } from "@/features/billing/components/TermPaymentStatusBadge";
import { MoneyInput } from "@/features/billing/components/paymentForm/MoneyInput";
import {
  parseAmount,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";
import { AllocationStatusBadge } from "@/features/billing/components/payments/AllocationStatusBadge";
import { ReceiptDownloads } from "@/features/billing/components/payments/ReceiptDownloads";
import {
  type AllocationDraft,
  draftSettlement,
  draftSuggestion,
  effectiveBillMinor,
  paidToDateAfterConfirm,
} from "@/features/billing/components/payments/reviewDraft";
import { SettlementToggle } from "@/features/billing/components/payments/SettlementToggle";
import { formatMoney } from "@/utils/currency";

interface AllocationReviewCardProps {
  allocation: AllocationView;
  currency: string;
  /** Present only for a PENDING child. */
  draft?: AllocationDraft;
  onDraftChange: (patch: Partial<AllocationDraft>) => void;
  onVoid: () => void;
  onCorrect: () => void;
  disabled: boolean;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

/**
 * One child of a payment under review (D4): its live bill, paid so far and balance across the
 * whole term, and the claim. A PENDING child is confirmed (editable amount, Partial/Full
 * pre-selected from the balance, optional-fee ticks) or rejected with a reason; a CONFIRMED one
 * can be voided or have its amount corrected.
 */
export function AllocationReviewCard({
  allocation,
  currency,
  draft,
  onDraftChange,
  onVoid,
  onCorrect,
  disabled,
}: AllocationReviewCardProps) {
  const id = useId();
  const status = allocation.termStatus;
  const money = (amount: number | null) => formatMoney(amount, currency);

  let overpaying = false;
  if (draft?.action === "CONFIRM") {
    const amountMinor = parseAmount(draft.amountText);
    const billMinor = effectiveBillMinor(allocation, draft.optionalFeeIds);
    overpaying =
      amountMinor !== null &&
      billMinor !== null &&
      paidToDateAfterConfirm(allocation, amountMinor) > billMinor;
  }
  const amountInvalid =
    draft?.action === "CONFIRM" &&
    draft.amountText.trim() !== "" &&
    parseAmount(draft.amountText) === null;

  return (
    <article
      aria-label={allocation.studentName}
      className="space-y-3 rounded-control border border-slate-200 p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-semibold text-slate-900">
            {allocation.studentName}
          </h3>
          <p className="text-xs text-slate-500">
            {[allocation.className, allocation.admissionNumber].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <AllocationStatusBadge status={allocation.status} settlement={allocation.settlement} />
          <TermPaymentStatusBadge
            status={status.state}
            hasPending={status.hasPending}
            inCredit={status.inCredit}
          />
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure
          label={allocation.bill ? `Bill ${allocation.bill.billReference}` : "Bill"}
          value={allocation.bill ? money(allocation.bill.total) : "No bill"}
        />
        <Figure label="Paid so far" value={money(status.confirmedPaid)} />
        <Figure
          label={status.balance !== null && status.balance < 0 ? "Credit" : "Balance"}
          value={status.balance === null ? "—" : money(Math.abs(status.balance))}
        />
        <Figure
          label={allocation.status === "CONFIRMED" ? "Confirmed" : "Claimed"}
          value={money(allocation.confirmedAmount ?? allocation.claimedAmount)}
        />
      </dl>
      {allocation.bill && !allocation.bill.published && (
        <p className="text-xs text-amber-700">This bill isn't published to guardians yet.</p>
      )}
      {allocation.optionalFees.length > 0 && allocation.status !== "PENDING" && (
        <p className="text-xs text-slate-500">
          Optional fees: {allocation.optionalFees.map((fee) => fee.feeName).join(", ")}
        </p>
      )}
      {allocation.reason && (
        <p className="text-sm text-slate-700">
          <span className="font-medium">Reason:</span> {allocation.reason}
        </p>
      )}

      {draft && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div
            role="radiogroup"
            aria-label={`Decision for ${allocation.studentName}`}
            className="grid grid-cols-3 gap-2"
          >
            {(
              [
                [null, "Leave pending"],
                ["CONFIRM", "Confirm"],
                ["REJECT", "Reject"],
              ] as const
            ).map(([action, label]) => (
              <label
                key={label}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-control border px-2 py-2 text-center text-sm font-medium ${
                  draft.action === action
                    ? action === "REJECT"
                      ? "border-red-400 bg-red-50 text-red-700"
                      : "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  className="sr-only"
                  name={`${id}-action`}
                  checked={draft.action === action}
                  disabled={disabled}
                  onChange={() => onDraftChange({ action })}
                />
                {label}
              </label>
            ))}
          </div>

          {draft.action === "CONFIRM" && (
            <div className="space-y-3">
              <FormField label="Confirmed amount" htmlFor={`${id}-amount`}>
                <MoneyInput
                  id={`${id}-amount`}
                  currency={currency}
                  value={draft.amountText}
                  disabled={disabled}
                  aria-invalid={amountInvalid || undefined}
                  onChange={(event) => onDraftChange({ amountText: event.target.value })}
                />
              </FormField>
              {amountInvalid && (
                <p className="text-sm text-red-600">
                  Enter an amount above zero, with at most two decimal places.
                </p>
              )}
              {draft.amountText.trim() !== "" &&
                parseAmount(draft.amountText) !== null &&
                parseAmount(draft.amountText) !== toMinorUnits(allocation.claimedAmount) && (
                  <p className="text-xs text-slate-500">
                    Differs from the {money(allocation.claimedAmount)} claimed.
                  </p>
                )}
              {overpaying && (
                <Alert variant="warning">
                  More than the balance - the extra will show as a credit for this term.
                </Alert>
              )}
              {(allocation.bill?.tickableOptionalFees.length ?? 0) > 0 && (
                <fieldset className="space-y-1">
                  <legend className="text-sm font-medium text-slate-700">
                    Optional fees this payment covers
                  </legend>
                  {allocation.bill!.tickableOptionalFees.map((fee) => (
                    <label
                      key={fee.feeId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-control border border-slate-200 px-3 py-2"
                    >
                      <Checkbox
                        checked={draft.optionalFeeIds.includes(fee.feeId)}
                        disabled={disabled}
                        onChange={() =>
                          onDraftChange({
                            optionalFeeIds: draft.optionalFeeIds.includes(fee.feeId)
                              ? draft.optionalFeeIds.filter((feeId) => feeId !== fee.feeId)
                              : [...draft.optionalFeeIds, fee.feeId],
                          })
                        }
                      />
                      <span className="flex-1 text-sm text-slate-800">{fee.feeName}</span>
                      <span className="text-sm font-medium text-slate-700">
                        {money(fee.amount)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <SettlementToggle
                value={draftSettlement(allocation, draft)}
                onChange={(settlement) => onDraftChange({ settlement, settlementTouched: true })}
                suggested={draftSuggestion(allocation, draft)}
                hasBill={allocation.bill !== null}
                disabled={disabled}
              />
            </div>
          )}

          {draft.action === "REJECT" && (
            <FormField label="Reason for rejecting" htmlFor={`${id}-reason`}>
              <Textarea
                id={`${id}-reason`}
                rows={2}
                maxLength={500}
                value={draft.reason}
                disabled={disabled}
                placeholder="The guardian sees this in their email and on the Fees page."
                onChange={(event) => onDraftChange({ reason: event.target.value })}
              />
            </FormField>
          )}
        </div>
      )}

      {allocation.status === "CONFIRMED" && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button variant="secondary" size="sm" onClick={onCorrect} disabled={disabled}>
            Correct amount
          </Button>
          <Button variant="danger" size="sm" onClick={onVoid} disabled={disabled}>
            Void
          </Button>
        </div>
      )}
      <ReceiptDownloads receipts={allocation.receipts} />
    </article>
  );
}
