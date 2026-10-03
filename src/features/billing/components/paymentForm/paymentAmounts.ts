/**
 * Money arithmetic for the fee-payment forms (Phase 45H, shared with 45I's admin Record payment):
 * amounts are typed as text and held in integer minor units (kobo), so a multi-child total sums
 * exactly - the backend refuses a payment whose children don't add up to its total to the kobo,
 * and floating-point addition (0.1 + 0.2) would otherwise trip that rule.
 */

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Parses what a user typed into a money field: grouping commas and spaces are ignored; at most
 * two decimal places; must be greater than zero. Returns minor units, or `null` when invalid.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  if (!AMOUNT_PATTERN.test(cleaned)) {
    return null;
  }
  const [whole, fraction = ""] = cleaned.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

/** A major-unit amount from the API (e.g. 1500.5) as minor units (150050). */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Minor units back to the major-unit number the API takes - exact for any 2-decimal amount. */
export function fromMinorUnits(minor: number): number {
  return minor / 100;
}

/** A plain editable string for an amount - "1500.5" -> "1500.50", whole amounts without decimals. */
export function formatAmountInput(amount: number): string {
  const minor = toMinorUnits(amount);
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

export function sumMinor(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
