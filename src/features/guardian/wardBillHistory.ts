import type { WardFeeTermView } from "@/api/feePayments";

function hasPublishedBill(term: WardFeeTermView): boolean {
  return term.published && !!term.billReference;
}

/**
 * The one term the Latest bill tab shows. `GET /me/wards/{id}/fees` already returns terms
 * newest-first, so this is the first term with a published bill (an advance term included,
 * since a school publishes next term's bill early on purpose). When nothing is published yet
 * the current term stands in, because payments can still be logged against it amount-only.
 */
export function latestBill(terms: WardFeeTermView[]): WardFeeTermView | null {
  return terms.find(hasPublishedBill) ?? terms.find((term) => term.current) ?? null;
}

/** Every term except the one on the Latest tab, in the order the API sent them (newest first). */
export function pastBills(terms: WardFeeTermView[], latest: WardFeeTermView | null): WardFeeTermView[] {
  return latest ? terms.filter((term) => term.termId !== latest.termId) : terms;
}
