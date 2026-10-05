/** Mirrors backend shared.domain.SupportedCurrency - every currency the platform prices and checks out in. */
export const SUPPORTED_CURRENCIES = ["NGN", "GHS", "ZAR", "KES", "USD"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Major units to minor units (naira to kobo): 125.5 -> 12550. Every supported currency has two
 * decimal places, which package_prices.amount_minor relies on. Rounds rather than truncates, so a
 * float like 0.29 (really 0.28999...) still becomes 29.
 */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

/** Minor units back to major units (kobo to naira): 12550 -> 125.5. */
export function fromMinor(amountMinor: number): number {
  return amountMinor / 100;
}

const FORMATTERS = new Map<string, Intl.NumberFormat>();

/**
 * Financial formatting for a package price: 25000, "NGN" -> "₦25,000.00".
 * Returns "—" when either part is missing (`SubscriptionSummaryView.price`
 * and `.currency` are both optional).
 *
 * The locale is pinned to "en-NG" deliberately: it is the only English locale
 * that renders NGN as the ₦ symbol - en-GB/en-US both emit the bare "NGN"
 * code, so honouring the browser's locale would silently undo the
 * formatting. Non-NGN codes still render with their own symbol
 * (USD -> "US$500.00").
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount == null || !Number.isFinite(amount) || !currency) {
    return "—";
  }
  let formatter = FORMATTERS.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-NG", { style: "currency", currency });
    } catch {
      // Malformed/unknown currency code - degrade to a grouped plain number
      // rather than blank the page (should only happen for bad data, since
      // the backend validates the code via java.util.Currency.getInstance).
      return `${currency} ${new Intl.NumberFormat("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
    }
    FORMATTERS.set(currency, formatter);
  }
  return formatter.format(amount);
}

const PLAIN_AMOUNT_FORMATTER = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Grouped, 2-decimal formatting for an amount that carries no currency - inventory's own
 * estimated costs/totals, which (like inventory_items.unit_price) are informational-only, with no
 * currency column anywhere in the module. Returns "—" when the amount is missing, the
 * formatMoney precedent.
 */
export function formatAmount(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return "—";
  }
  return PLAIN_AMOUNT_FORMATTER.format(amount);
}

const SYMBOLS = new Map<string, string>();

/**
 * Just the currency's symbol, for a money input's leading adornment: "NGN" -> "₦". Uses the same
 * pinned "en-NG" locale as {@link formatMoney}, so the prefix and the formatted amounts elsewhere
 * on the screen always agree. Falls back to the code itself for one Intl can't format.
 */
export function currencySymbol(currency: string): string {
  let symbol = SYMBOLS.get(currency);
  if (symbol === undefined) {
    try {
      symbol =
        new Intl.NumberFormat("en-NG", { style: "currency", currency })
          .formatToParts(0)
          .find((part) => part.type === "currency")?.value ?? currency;
    } catch {
      symbol = currency;
    }
    SYMBOLS.set(currency, symbol);
  }
  return symbol;
}
