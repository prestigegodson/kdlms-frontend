import type { PaymentRequest, WardFeeTermView } from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import {
  formatAmountInput,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";
import {
  type ChildDraft,
  type ChildDrafts,
  childRequests,
  hasOptionalFees,
  type PaymentChildOption,
  prefillAmount,
  stillTickable,
  totalMinor,
} from "@/features/billing/components/paymentForm/paymentChildren";
import type { PaymentDetails } from "@/features/billing/components/paymentForm/paymentDetails";
import type { LogPaymentIntent } from "@/features/guardian/components/LogPaymentSheet";

export type StepKey = "school" | "term" | "children" | "optional" | "details" | "proof";

export const STEP_TITLES: Record<StepKey, string> = {
  school: "School",
  term: "Term",
  children: "Children & amounts",
  optional: "Optional fees",
  details: "Payment details",
  proof: "Proof & review",
};

/**
 * One ward as a row of the children step - the shared `PaymentChildOption` (grouped by school)
 * plus the ward and its own card for the payment's term, which the edit/resubmit prefill reads.
 */
export interface ChildOption extends PaymentChildOption {
  ward: MyWardView;
  term: WardFeeTermView | null;
}

/** The payment being edited, if any - its own claims are never disabled and seed the prefill. */
export function editingPaymentId(intent: LogPaymentIntent): string | null {
  return intent.kind === "edit" ? intent.payment.paymentId : null;
}

/** This ward's own share of the payment being edited, if it's on it. */
function claimOnEditedPayment(term: WardFeeTermView | null, paymentId: string | null) {
  if (!term || !paymentId) {
    return null;
  }
  return term.payments.find((payment) => payment.paymentId === paymentId) ?? null;
}

function option(
  ward: MyWardView,
  term: WardFeeTermView | null,
  disabledReason: string | null,
  outstandingMinor: number | null,
): ChildOption {
  return {
    ward,
    term,
    studentId: ward.studentId,
    name: ward.fullName,
    groupLabel: ward.schoolName,
    disabledReason,
    balance: term?.balance ?? null,
    outstandingMinor,
    optionalFees: term?.optionalFees ?? [],
  };
}

/**
 * Every ward as a children-step row: the payment's school's wards are tickable unless the term
 * isn't open for them or is already paid in full (D6) - a child already on the payment being
 * edited is never disabled. Every other school's ward is disabled outright (D3), or left out
 * altogether when `hideOtherSchools` is set (the page-level flow, where the school was picked
 * first). `termsByStudent` holds each same-school ward's card for the payment's term: a `null`
 * value means it has no card for that term (not open for it), and a missing key means its fees
 * failed to load.
 */
export function childOptions(
  context: { schoolId: string; editingPaymentId: string | null; hideOtherSchools: boolean },
  wards: MyWardView[],
  termsByStudent: Map<string, WardFeeTermView | null>,
): ChildOption[] {
  const { schoolId, editingPaymentId: paymentId, hideOtherSchools } = context;
  const rows = hideOtherSchools ? wards.filter((ward) => ward.schoolId === schoolId) : wards;
  return rows.map((ward) => {
    if (ward.schoolId !== schoolId) {
      return option(ward, null, "Different school — log separately", null);
    }
    if (!termsByStudent.has(ward.studentId)) {
      return option(ward, null, "Couldn't load this child's fees", null);
    }
    const term = termsByStudent.get(ward.studentId) ?? null;
    if (!term) {
      return option(ward, null, "Not open for this term", null);
    }
    const ownClaim = claimOnEditedPayment(term, paymentId);
    let disabledReason: string | null = null;
    if (!ownClaim && !term.canLogPayment) {
      disabledReason = "Paid in full";
    }
    let outstandingMinor: number | null = null;
    if (term.balance != null) {
      const otherPending =
        toMinorUnits(term.pendingAmount) - (ownClaim ? toMinorUnits(ownClaim.claimedAmount) : 0);
      outstandingMinor = Math.max(toMinorUnits(term.balance) - Math.max(otherPending, 0), 0);
    }
    return option(ward, term, disabledReason, outstandingMinor);
  });
}

/**
 * The terms a page-level payment may be logged for: every term on any of the school's wards'
 * cards that at least one of them can still pay (D20), deduplicated, newest first - the order
 * each ward's cards already arrive in.
 */
export function payableTerms(cardLists: WardFeeTermView[][]): WardFeeTermView[] {
  const byTerm = new Map<string, WardFeeTermView>();
  for (const cards of cardLists) {
    for (const card of cards) {
      if (card.canLogPayment && !byTerm.has(card.termId)) {
        byTerm.set(card.termId, card);
      }
    }
  }
  return [...byTerm.values()].sort(
    (a, b) => b.sessionName.localeCompare(a.sessionName) || b.termNumber - a.termNumber,
  );
}

/** The current term when it's payable, otherwise the newest payable one. */
export function defaultTermId(terms: WardFeeTermView[]): string | null {
  return (terms.find((term) => term.current) ?? terms[0])?.termId ?? null;
}

/**
 * The children step's starting state: a new payment ticks the intent ward with its outstanding
 * balance; an edit ticks every ward already on the payment with its own claim and ticks; a
 * resubmit ticks the intent ward with the rejected claim. A page-level payment has no intent
 * ward, so it ticks a child only when exactly one can be ticked.
 */
export function initialDrafts(intent: LogPaymentIntent, options: ChildOption[]): ChildDrafts {
  const drafts: ChildDrafts = {};
  const paymentId = editingPaymentId(intent);
  const tickable = options.filter((childOption) => childOption.disabledReason === null);
  const soleTickable = intent.kind === "open" && tickable.length === 1 ? tickable[0].studentId : null;
  for (const childOption of options) {
    const id = childOption.studentId;
    const draft: ChildDraft = { selected: false, amountText: "", optionalFeeIds: [] };
    if (intent.kind === "edit") {
      const claim = claimOnEditedPayment(childOption.term, paymentId);
      if (claim) {
        draft.selected = true;
        draft.amountText = formatAmountInput(claim.claimedAmount);
        draft.optionalFeeIds = stillTickable(
          childOption,
          claim.optionalFees.map((fee) => fee.feeId),
        );
      }
    } else if (intent.kind === "open") {
      if (id === soleTickable) {
        draft.selected = true;
        draft.amountText = prefillAmount(childOption);
      }
    } else if (id === intent.studentId) {
      draft.selected = true;
      if (intent.kind === "resubmit") {
        draft.amountText = formatAmountInput(intent.payment.claimedAmount);
        draft.optionalFeeIds = stillTickable(
          childOption,
          intent.payment.optionalFees.map((fee) => fee.feeId),
        );
      } else {
        draft.amountText = prefillAmount(childOption);
      }
    }
    drafts[id] = draft;
  }
  return drafts;
}

/**
 * The optional-fees step only appears when some ticked child has an unselected optional fee (D8).
 * `leading` is the page-level flow's school/term steps, which come before everything else.
 */
export function stepsFor(options: ChildOption[], drafts: ChildDrafts, leading: StepKey[] = []): StepKey[] {
  return hasOptionalFees(options, drafts)
    ? [...leading, "children", "optional", "details", "proof"]
    : [...leading, "children", "details", "proof"];
}

/**
 * The submit/edit body. The total is the sum of the children's amounts computed in minor units,
 * so it always matches the backend's per-child sum rule to the kobo.
 */
export function buildRequest(
  termId: string,
  options: ChildOption[],
  drafts: ChildDrafts,
  details: PaymentDetails,
  keepAttachmentFileIds?: string[],
): PaymentRequest {
  const request: PaymentRequest = {
    termId,
    payerName: details.payerName.trim(),
    paymentDate: details.paymentDate,
    // The details step can't be passed without a method, so this is never null by submit.
    method: details.method ?? "OTHER",
    note: details.note.trim() === "" ? null : details.note.trim(),
    totalAmount: totalMinor(options, drafts) / 100,
    children: childRequests(options, drafts),
  };
  if (keepAttachmentFileIds) {
    request.keepAttachmentFileIds = keepAttachmentFileIds;
  }
  return request;
}
