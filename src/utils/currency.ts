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
