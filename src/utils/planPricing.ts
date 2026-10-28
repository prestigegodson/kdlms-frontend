import type { BillingCycle, PackagePrice } from "@/api/packages";
import type { SupportedCurrency } from "@/utils/currency";

/**
 * Reading a package's per-cycle prices (V165): a tutor plan may be sold monthly, annually or both,
 * a school package in its one billing cycle. Kept out of `api/packages.ts` so a test that mocks
 * the API module still gets the real helpers.
 */

interface Priced {
  prices: PackagePrice[];
}

/** The plan's list price for `cycle` in `currency`, or null when it isn't sold that way. */
export function priceFor(plan: Priced, cycle: BillingCycle, currency: SupportedCurrency): number | null {
  return (
    plan.prices.find((price) => price.billingCycle === cycle && price.currency === currency)
      ?.amountMinor ?? null
  );
}

/** The cycles a plan is priced in, monthly first. */
export function cyclesOf(plan: Priced): BillingCycle[] {
  return (["MONTHLY", "ANNUAL"] as const).filter((cycle) =>
    plan.prices.some((price) => price.billingCycle === cycle),
  );
}
