import type { Settlement } from "@/api/feePayments";
import type { AllocationView, ReviewAction, ReviewItemRequest } from "@/api/staffFeePayments";
import {
  formatAmountInput,
  fromMinorUnits,
  parseAmount,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";

/**
 * The admin review state for one payment (Phase 45I) - one draft per still-pending child, plus the
 * settlement suggestion the confirm controls pre-select from. Pure, so the review modal, the
 * Record payment modal and the Correct amount dialog all suggest settlements identically.
 */

/**
 * Mirrors backend `Settlement.suggest`: FULL once the paid-to-date total (every non-voided
 * confirmed amount, including the one being confirmed) covers the bill, otherwise PARTIAL. With
 * no bill (D2) it's always PARTIAL. All amounts in minor units.
 */
export function suggestSettlement(
  billTotalMinor: number | null,
  paidToDateMinor: number,
): Settlement {
  if (billTotalMinor === null) {
    return "PARTIAL";
  }
  return paidToDateMinor >= billTotalMinor ? "FULL" : "PARTIAL";
}

/** Mirrors backend `Settlement.mismatches` - never a mismatch without a bill. */
export function settlementMismatches(
  chosen: Settlement,
  billTotalMinor: number | null,
  paidToDateMinor: number,
): boolean {
  return billTotalMinor !== null && chosen !== suggestSettlement(billTotalMinor, paidToDateMinor);
}

export interface AllocationDraft {
  action: ReviewAction | null;
  amountText: string;
  settlement: Settlement | null;
  /** Whether the admin has picked the settlement themselves - until then it follows the suggestion. */
  settlementTouched: boolean;
  optionalFeeIds: string[];
  reason: string;
}

export type AllocationDrafts = Record<string, AllocationDraft>;

/**
 * The bill total a confirm would settle against, in minor units: the live bill plus any optional
 * fee ticked here that isn't on it yet (confirming opts the child into it, D8). Null with no bill.
 */
export function effectiveBillMinor(
  allocation: AllocationView,
  optionalFeeIds: string[],
): number | null {
  if (!allocation.bill) {
    return null;
  }
  const ticked = new Set(optionalFeeIds);
  const added = allocation.bill.tickableOptionalFees
    .filter((fee) => ticked.has(fee.feeId))
    .reduce((sum, fee) => sum + toMinorUnits(fee.amount), 0);
  return toMinorUnits(allocation.bill.total) + added;
}

/** What confirming this pending child for `amountMinor` would bring its term's paid-to-date to. */
export function paidToDateAfterConfirm(allocation: AllocationView, amountMinor: number): number {
  return toMinorUnits(allocation.termStatus.confirmedPaid) + amountMinor;
}

/** The suggestion for a pending child's draft as it stands - follows the typed amount and ticks live. */
export function draftSuggestion(allocation: AllocationView, draft: AllocationDraft): Settlement {
  const amountMinor = parseAmount(draft.amountText) ?? 0;
  return suggestSettlement(
    effectiveBillMinor(allocation, draft.optionalFeeIds),
    paidToDateAfterConfirm(allocation, amountMinor),
  );
}

/** The settlement a draft will send: the admin's own pick once touched, otherwise the live suggestion. */
export function draftSettlement(allocation: AllocationView, draft: AllocationDraft): Settlement {
  return draft.settlementTouched && draft.settlement
    ? draft.settlement
    : draftSuggestion(allocation, draft);
}

/** Every pending child starts undecided, prefilled with its claim, its claimed optional fees and the server's suggestion. */
export function initialAllocationDrafts(allocations: AllocationView[]): AllocationDrafts {
  const drafts: AllocationDrafts = {};
  for (const allocation of allocations) {
    if (allocation.status !== "PENDING") continue;
    const tickable = new Set(allocation.bill?.tickableOptionalFees.map((fee) => fee.feeId) ?? []);
    drafts[allocation.id] = {
      action: null,
      amountText: formatAmountInput(allocation.claimedAmount),
      settlement: allocation.suggestedSettlement,
      settlementTouched: false,
      optionalFeeIds: allocation.optionalFees
        .map((fee) => fee.feeId)
        .filter((feeId) => tickable.has(feeId)),
      reason: "",
    };
  }
  return drafts;
}

/** A draft with no action is simply left pending; a confirm needs a valid amount, a reject a reason. */
export function reviewItemValid(draft: AllocationDraft): boolean {
  if (draft.action === "CONFIRM") {
    return parseAmount(draft.amountText) !== null;
  }
  if (draft.action === "REJECT") {
    return draft.reason.trim() !== "";
  }
  return true;
}

/** At least one child decided, and every decided child valid. */
export function reviewSubmittable(drafts: AllocationDrafts): boolean {
  const decided = Object.values(drafts).filter((draft) => draft.action !== null);
  return decided.length > 0 && decided.every(reviewItemValid);
}

/** The review body - only decided children, each echoing its `version` for the optimistic check. */
export function buildReviewItems(
  allocations: AllocationView[],
  drafts: AllocationDrafts,
): ReviewItemRequest[] {
  const items: ReviewItemRequest[] = [];
  for (const allocation of allocations) {
    const draft = drafts[allocation.id];
    if (!draft || draft.action === null) continue;
    if (draft.action === "CONFIRM") {
      items.push({
        allocationId: allocation.id,
        version: allocation.version,
        action: "CONFIRM",
        confirmedAmount: fromMinorUnits(parseAmount(draft.amountText) ?? 0),
        settlement: draftSettlement(allocation, draft),
        optionalFeeIds: draft.optionalFeeIds,
        reason: null,
      });
    } else {
      items.push({
        allocationId: allocation.id,
        version: allocation.version,
        action: "REJECT",
        confirmedAmount: null,
        settlement: null,
        optionalFeeIds: [],
        reason: draft.reason.trim(),
      });
    }
  }
  return items;
}
