import type { OptionalFeeView } from "@/api/feePayments";
import {
  formatAmountInput,
  fromMinorUnits,
  parseAmount,
  sumMinor,
} from "@/features/billing/components/paymentForm/paymentAmounts";

/**
 * The children-and-amounts half of a fee-payment form (D3), shared by the guardian's log-payment
 * sheet (Phase 45H) and the admin's Record payment modal (Phase 45I). Each side maps its own data
 * (a guardian's ward + term card; an admin's searched student + ledger) into a neutral
 * `PaymentChildOption`, so the step components and these helpers never know which one they serve.
 */

/** Mirrors backend FeePayment.MAX_CHILDREN. */
export const MAX_PAYMENT_CHILDREN = 10;

export interface PaymentChildOption {
  studentId: string;
  name: string;
  /** Rows are grouped under this heading when more than one group is present (a guardian's schools). */
  groupLabel: string;
  /** Why the row can't be ticked, or null when it can. */
  disabledReason: string | null;
  /** A non-blocking caution shown in place of the balance hint (e.g. an admin recording against a paid-in-full term, D6). */
  warning?: string | null;
  /** The term's live balance (major units) - null with no bill (amount-only, D2); negative is a credit. */
  balance: number | null;
  /**
   * What's left to pay, in minor units, after confirmed and other pending payments - the amount
   * prefill and the overpayment-warning threshold. Null when the term has no bill.
   */
  outstandingMinor: number | null;
  /** The bill's unselected optional fees the payment may tick (D8). */
  optionalFees: OptionalFeeView[];
}

export interface ChildDraft {
  selected: boolean;
  amountText: string;
  optionalFeeIds: string[];
}

export type ChildDrafts = Record<string, ChildDraft>;

export function prefillAmount(option: PaymentChildOption): string {
  return option.outstandingMinor && option.outstandingMinor > 0
    ? formatAmountInput(fromMinorUnits(option.outstandingMinor))
    : "";
}

/** The ticked optional fees still tickable on this child's bill - a stale id is dropped silently. */
export function stillTickable(option: PaymentChildOption, feeIds: string[]): string[] {
  const available = new Set(option.optionalFees.map((fee) => fee.feeId));
  return feeIds.filter((feeId) => available.has(feeId));
}

/** Ticking a child prefills its outstanding balance if its amount is still blank. */
export function toggleChild(drafts: ChildDrafts, option: PaymentChildOption): ChildDrafts {
  const id = option.studentId;
  const current = drafts[id] ?? { selected: false, amountText: "", optionalFeeIds: [] };
  const selected = !current.selected;
  return {
    ...drafts,
    [id]: {
      ...current,
      selected,
      amountText:
        selected && current.amountText === "" ? prefillAmount(option) : current.amountText,
    },
  };
}

export function toggleOptionalFee(
  drafts: ChildDrafts,
  studentId: string,
  feeId: string,
): ChildDrafts {
  const draft = drafts[studentId];
  const ids = draft.optionalFeeIds.includes(feeId)
    ? draft.optionalFeeIds.filter((id) => id !== feeId)
    : [...draft.optionalFeeIds, feeId];
  return { ...drafts, [studentId]: { ...draft, optionalFeeIds: ids } };
}

export function selectedOptions<T extends PaymentChildOption>(
  options: T[],
  drafts: ChildDrafts,
): T[] {
  return options.filter(
    (option) => option.disabledReason === null && drafts[option.studentId]?.selected,
  );
}

export function childrenStepValid(options: PaymentChildOption[], drafts: ChildDrafts): boolean {
  const selected = selectedOptions(options, drafts);
  return (
    selected.length > 0 &&
    selected.length <= MAX_PAYMENT_CHILDREN &&
    selected.every((option) => parseAmount(drafts[option.studentId].amountText) !== null)
  );
}

/** Total of every ticked child's valid amount, in minor units - an invalid amount counts as zero. */
export function totalMinor(options: PaymentChildOption[], drafts: ChildDrafts): number {
  return sumMinor(
    selectedOptions(options, drafts).map(
      (option) => parseAmount(drafts[option.studentId].amountText) ?? 0,
    ),
  );
}

/** Whether any ticked child has an unselected optional fee - the optional-fees step only appears then (D8). */
export function hasOptionalFees(options: PaymentChildOption[], drafts: ChildDrafts): boolean {
  return selectedOptions(options, drafts).some((option) => option.optionalFees.length > 0);
}

/** Each ticked child's amount and still-tickable fees, for a submit/record body. */
export function childRequests(options: PaymentChildOption[], drafts: ChildDrafts) {
  return selectedOptions(options, drafts).map((option) => {
    const draft = drafts[option.studentId];
    return {
      studentId: option.studentId,
      amount: fromMinorUnits(parseAmount(draft.amountText) ?? 0),
      optionalFeeIds: stillTickable(option, draft.optionalFeeIds),
    };
  });
}
