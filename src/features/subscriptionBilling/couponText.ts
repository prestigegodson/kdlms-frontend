import type { CouponDuration, CouponType } from "@/api/subscriptionBilling";
import { formatMoney, fromMinor, type SupportedCurrency } from "@/utils/currency";

/** "20% off" or "₦1,000.00 off". */
export function discountLabel(
  type: CouponType,
  value: number,
  currency: SupportedCurrency | null,
): string {
  if (type === "PERCENT") return `${value}% off`;
  return `${formatMoney(fromMinor(value), currency ?? "NGN")} off`;
}

/** How many payments a coupon discounts, the first included. */
export function durationLabel(duration: CouponDuration, durationPeriods: number | null): string {
  if (duration === "ONCE") return "first payment only";
  if (duration === "FOREVER") return "every payment";
  return `first ${durationPeriods ?? 2} payments`;
}

/** How many more renewals a redeemed coupon discounts; null means all of them. */
export function remainingLabel(periodsRemaining: number | null): string {
  if (periodsRemaining == null) return "every renewal";
  return periodsRemaining === 1 ? "your next renewal" : `your next ${periodsRemaining} renewals`;
}
