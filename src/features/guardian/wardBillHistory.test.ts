import { describe, expect, it } from "vitest";
import type { WardFeeTermView } from "@/api/feePayments";
import { latestBill, pastBills } from "@/features/guardian/wardBillHistory";

function term(overrides: Partial<WardFeeTermView>): WardFeeTermView {
  return {
    sessionId: "session-1",
    sessionName: "2026/2027",
    termId: "term-1",
    termName: "First Term",
    termNumber: 1,
    current: false,
    advance: false,
    published: true,
    billReference: "REF",
    currency: "NGN",
    billed: 1000,
    confirmedPaid: 0,
    pendingAmount: 0,
    balance: 1000,
    status: "UNPAID",
    hasPending: false,
    inCredit: false,
    canLogPayment: true,
    optionalFees: [],
    payments: [],
    ...overrides,
  };
}

describe("latestBill", () => {
  it("picks the newest published bill, an advance term included", () => {
    const advance = term({ termId: "t2", advance: true });
    const current = term({ termId: "t1", current: true });
    expect(latestBill([advance, current])).toBe(advance);
  });

  it("skips unpublished terms and terms without a bill reference", () => {
    const unpublished = term({ termId: "t3", published: false, billReference: null });
    const noReference = term({ termId: "t2", billReference: null });
    const published = term({ termId: "t1" });
    expect(latestBill([unpublished, noReference, published])).toBe(published);
  });

  it("falls back to the current term when nothing is published", () => {
    const next = term({ termId: "t2", published: false, billReference: null });
    const current = term({ termId: "t1", current: true, published: false, billReference: null });
    expect(latestBill([next, current])).toBe(current);
  });

  it("returns null when there is no published bill and no current term", () => {
    expect(latestBill([])).toBeNull();
    expect(latestBill([term({ published: false, billReference: null })])).toBeNull();
  });
});

describe("pastBills", () => {
  it("drops only the latest term and keeps the order", () => {
    const a = term({ termId: "a" });
    const b = term({ termId: "b" });
    const c = term({ termId: "c" });
    expect(pastBills([a, b, c], b)).toEqual([a, c]);
  });

  it("returns every term when there is no latest", () => {
    const a = term({ termId: "a", published: false });
    expect(pastBills([a], null)).toEqual([a]);
  });
});
