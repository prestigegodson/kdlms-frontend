import { describe, expect, it } from "vitest";
import { formatMoney } from "@/utils/currency";

describe("formatMoney", () => {
  it("formats a naira amount with the symbol, grouping, and 2dp", () => {
    expect(formatMoney(25000, "NGN")).toBe("₦25,000.00");
  });

  it("groups six-figure amounts instead of printing a bare run of digits", () => {
    // The regression this whole change is for: SubscriptionPage used to
    // interpolate `${currency} ${price.toFixed(2)}`, i.e. "NGN 250000.00".
    expect(formatMoney(250000, "NGN")).toBe("₦250,000.00");
  });

  it("formats non-NGN currencies with their own symbol", () => {
    expect(formatMoney(500, "USD")).toBe("US$500.00");
  });

  it("rounds to 2dp", () => {
    expect(formatMoney(1234567.891, "NGN")).toBe("₦1,234,567.89");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "NGN")).toBe("₦0.00");
  });

  it("returns an em dash for a missing amount", () => {
    expect(formatMoney(undefined, "NGN")).toBe("—");
    expect(formatMoney(null, "NGN")).toBe("—");
  });

  it("returns an em dash for a missing currency", () => {
    expect(formatMoney(25000, undefined)).toBe("—");
    expect(formatMoney(25000, null)).toBe("—");
    expect(formatMoney(25000, "")).toBe("—");
  });

  it("does not throw for a malformed currency code", () => {
    // Intl.NumberFormat throws a RangeError for a code that isn't a
    // well-formed ISO 4217 string - guard against a render crash.
    expect(formatMoney(25000, "N")).toBe("N 25,000.00");
  });
});
