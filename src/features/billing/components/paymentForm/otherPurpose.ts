import type { OtherPaymentItemView } from "@/api/feePayments";

/** Mirrors backend PaymentFor.MAX_LABEL_LENGTH. */
export const MAX_PURPOSE_LABEL_LENGTH = 160;

/**
 * What an "other" payment (D24) is for, as the purpose step holds it: one of the school's items
 * (`choice` is its id), or "custom" with the payer's own `label`. `null` until something is picked.
 */
export interface PurposeDraft {
  choice: string | "custom" | null;
  label: string;
}

export const EMPTY_PURPOSE: PurposeDraft = { choice: null, label: "" };

export function purposeValid(draft: PurposeDraft): boolean {
  if (draft.choice === null) return false;
  if (draft.choice !== "custom") return true;
  const label = draft.label.trim();
  return label !== "" && label.length <= MAX_PURPOSE_LABEL_LENGTH;
}

/** The request fields for a purpose - an item's id, or the free-text label. */
export function purposeFields(draft: PurposeDraft): {
  otherItemId: string | null;
  purposeLabel: string | null;
} {
  if (draft.choice === null || draft.choice === "custom") {
    return { otherItemId: null, purposeLabel: draft.label.trim() || null };
  }
  return { otherItemId: draft.choice, purposeLabel: null };
}

/** The item a draft points at, if it picked one. */
export function chosenItem(
  draft: PurposeDraft,
  items: OtherPaymentItemView[],
): OtherPaymentItemView | null {
  return items.find((item) => item.id === draft.choice) ?? null;
}

/** What the draft says the payment is for, for the review summary. */
export function purposeLabelOf(draft: PurposeDraft, items: OtherPaymentItemView[]): string {
  return chosenItem(draft, items)?.name ?? draft.label.trim();
}

/**
 * The draft an edit or resubmit starts from. A payment logged against an item the school has
 * since retired keeps that item on an edit (the backend accepts it, D24) - `withRetired` adds it
 * to the picker under its frozen label so it stays selectable.
 */
export function purposeFromPayment(
  payment: { otherItemId: string | null; purposeLabel: string | null },
  items: OtherPaymentItemView[],
  keepRetiredItem: boolean,
): { draft: PurposeDraft; items: OtherPaymentItemView[] } {
  if (payment.otherItemId) {
    if (items.some((item) => item.id === payment.otherItemId)) {
      return { draft: { choice: payment.otherItemId, label: "" }, items };
    }
    if (keepRetiredItem) {
      const retired: OtherPaymentItemView = {
        id: payment.otherItemId,
        name: payment.purposeLabel ?? "",
        amount: null,
        active: false,
        position: Number.MAX_SAFE_INTEGER,
        createdAt: "",
        updatedAt: "",
      };
      return { draft: { choice: payment.otherItemId, label: "" }, items: [...items, retired] };
    }
  }
  return { draft: { choice: "custom", label: payment.purposeLabel ?? "" }, items };
}
