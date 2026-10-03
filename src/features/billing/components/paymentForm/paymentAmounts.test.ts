import { describe, expect, it } from "vitest";
import {
  formatAmountInput,
  fromMinorUnits,
  parseAmount,
  sumMinor,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";

describe("parseAmount", () => {
  it("reads whole and decimal amounts as minor units", () => {
    expect(parseAmount("1500")).toBe(150000);
    expect(parseAmount("1500.5")).toBe(150050);
    expect(parseAmount("0.01")).toBe(1);
  });

  it("ignores grouping commas and spaces", () => {
    expect(parseAmount("150,000.25")).toBe(15000025);
    expect(parseAmount(" 1 000 ")).toBe(100000);
  });

  it("rejects zero, negatives, more than two decimals and non-numbers", () => {
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("0.00")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("1.")).toBeNull();
  });
});

describe("minor-unit arithmetic", () => {
  it("sums exactly where floating point wouldn't", () => {
    const total = sumMinor([parseAmount("0.1")!, parseAmount("0.2")!]);
    expect(fromMinorUnits(total)).toBe(0.3);
  });

  it("round-trips API amounts", () => {
    expect(toMinorUnits(1500.55)).toBe(150055);
    expect(formatAmountInput(1500)).toBe("1500");
    expect(formatAmountInput(1500.5)).toBe("1500.50");
  });
});
