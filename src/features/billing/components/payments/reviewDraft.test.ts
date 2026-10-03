import { describe, expect, it } from "vitest";
import {
  buildReviewItems,
  draftSettlement,
  initialAllocationDrafts,
  reviewItemValid,
  reviewSubmittable,
  settlementMismatches,
  suggestSettlement,
} from "@/features/billing/components/payments/reviewDraft";
import { allocation, termStatus } from "@/features/billing/components/payments/testFixtures";

describe("suggestSettlement", () => {
  it("is FULL once paid-to-date covers the bill exactly or more", () => {
    expect(suggestSettlement(5_000_000, 5_000_000)).toBe("FULL");
    expect(suggestSettlement(5_000_000, 6_000_000)).toBe("FULL");
  });

  it("is PARTIAL below the bill, and always PARTIAL with no bill", () => {
    expect(suggestSettlement(5_000_000, 4_999_999)).toBe("PARTIAL");
    expect(suggestSettlement(null, 9_999_999)).toBe("PARTIAL");
  });

  it("never flags a mismatch without a bill", () => {
    expect(settlementMismatches("FULL", null, 0)).toBe(false);
    expect(settlementMismatches("FULL", 5_000_000, 100)).toBe(true);
    expect(settlementMismatches("PARTIAL", 5_000_000, 100)).toBe(false);
  });
});

describe("review drafts", () => {
  it("starts each pending child undecided, prefilled with its claim, and skips reviewed children", () => {
    const drafts = initialAllocationDrafts([
      allocation(),
      allocation({ id: "alloc-2", status: "CONFIRMED" }),
    ]);
    expect(Object.keys(drafts)).toEqual(["alloc-1"]);
    expect(drafts["alloc-1"]).toMatchObject({
      action: null,
      amountText: "20000",
      settlement: "PARTIAL",
    });
  });

  it("follows the live suggestion until the admin picks, counting confirmed payments and ticked optional fees", () => {
    const child = allocation({
      termStatus: termStatus({ confirmedPaid: 30000 }),
      bill: {
        billReference: "B-1",
        total: 50000,
        published: true,
        tickableOptionalFees: [
          { feeId: "fee-x", feeName: "Excursion", amount: 5000, applied: false },
        ],
      },
    });
    const draft = initialAllocationDrafts([child])["alloc-1"];
    expect(draftSettlement(child, { ...draft, action: "CONFIRM" })).toBe("FULL");
    // Ticking the excursion raises the bill to 55,000 - 50,000 paid no longer covers it.
    expect(draftSettlement(child, { ...draft, action: "CONFIRM", optionalFeeIds: ["fee-x"] })).toBe(
      "PARTIAL",
    );
    expect(
      draftSettlement(child, {
        ...draft,
        action: "CONFIRM",
        settlement: "PARTIAL",
        settlementTouched: true,
      }),
    ).toBe("PARTIAL");
  });

  it("needs a valid amount to confirm and a reason to reject", () => {
    const base = initialAllocationDrafts([allocation()])["alloc-1"];
    expect(reviewItemValid({ ...base, action: "CONFIRM", amountText: "0" })).toBe(false);
    expect(reviewItemValid({ ...base, action: "CONFIRM", amountText: "150.5" })).toBe(true);
    expect(reviewItemValid({ ...base, action: "REJECT", reason: "  " })).toBe(false);
    expect(reviewItemValid({ ...base, action: "REJECT", reason: "Wrong slip" })).toBe(true);
    expect(reviewSubmittable({ a: base })).toBe(false);
  });

  it("sends only decided children, echoing each version", () => {
    const first = allocation();
    const second = allocation({ id: "alloc-2", version: 7, studentId: "student-2" });
    const third = allocation({ id: "alloc-3", studentId: "student-3" });
    const drafts = initialAllocationDrafts([first, second, third]);
    drafts["alloc-1"] = { ...drafts["alloc-1"], action: "CONFIRM", amountText: "18,000.50" };
    drafts["alloc-2"] = { ...drafts["alloc-2"], action: "REJECT", reason: " Unreadable " };

    expect(buildReviewItems([first, second, third], drafts)).toEqual([
      {
        allocationId: "alloc-1",
        version: 3,
        action: "CONFIRM",
        confirmedAmount: 18000.5,
        settlement: "PARTIAL",
        optionalFeeIds: [],
        reason: null,
      },
      {
        allocationId: "alloc-2",
        version: 7,
        action: "REJECT",
        confirmedAmount: null,
        settlement: null,
        optionalFeeIds: [],
        reason: "Unreadable",
      },
    ]);
  });
});
