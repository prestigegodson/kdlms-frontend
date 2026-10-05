import { type FormEvent, useState } from "react";
import { getErrorMessage } from "@/api/client";
import type { PackageView } from "@/api/packages";
import {
  type CheckoutResult,
  type CouponQuoteView,
  checkout,
  validateCoupon,
} from "@/api/subscriptionBilling";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatMoney, fromMinor, type SupportedCurrency } from "@/utils/currency";
import { durationLabel } from "../couponText";

interface CheckoutDialogProps {
  plan: PackageView;
  currency: SupportedCurrency;
  /** The plan's list price in `currency`. */
  priceMinor: number;
  /**
   * The plan replaces a paid plan that still has time left, starting today with nothing carried
   * over (creators.md §12.1, no proration).
   */
  replacesCurrentPlan?: boolean;
  onClose: () => void;
  /** The server's answer - the caller redirects, or reports a scheduled change or an activated plan. */
  onResult: (result: CheckoutResult) => void;
}

/**
 * Confirms a plan purchase (creators.md §6.1-6.2): the list price, an optional coupon previewed by
 * the server, and the amount due. The server prices the checkout again, coupon included - the
 * preview reserves nothing.
 */
export function CheckoutDialog({
  plan,
  currency,
  priceMinor,
  replacesCurrentPlan = false,
  onClose,
  onResult,
}: CheckoutDialogProps) {
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<CouponQuoteView | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const due = quote ? quote.amountDueMinor : priceMinor;
  const money = (minor: number) => formatMoney(fromMinor(minor), currency);

  async function apply(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setApplying(true);
    setCouponError(null);
    try {
      setQuote(await validateCoupon(trimmed, plan.id, currency));
    } catch (caught) {
      setQuote(null);
      setCouponError(getErrorMessage(caught, "That coupon can't be used."));
    } finally {
      setApplying(false);
    }
  }

  function removeCoupon() {
    setQuote(null);
    setCode("");
    setCouponError(null);
  }

  async function pay() {
    setPaying(true);
    setError(null);
    try {
      onResult(await checkout(plan.id, currency, quote?.code ?? null));
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't start the payment. Please try again."));
      setPaying(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Choose ${plan.name}`} size="md">
      <div className="space-y-4">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">{plan.name}</dt>
            <dd className="text-slate-900">
              {money(priceMinor)}
              {plan.billingCycle === "ANNUAL" ? " / year" : " / month"}
            </dd>
          </div>
          {quote && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">
                Coupon <span className="font-mono">{quote.code}</span>
              </dt>
              <dd className="text-green-700">−{money(quote.discountMinor)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-2 font-semibold">
            <dt className="text-slate-900">Due today</dt>
            <dd className="text-slate-900">{money(due)}</dd>
          </div>
        </dl>

        {quote ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">
              {quote.description ? `${quote.description} - ` : ""}
              applies to the {durationLabel(quote.duration, quote.durationPeriods)}.
            </span>
            <Button size="sm" variant="ghost" onClick={removeCoupon} disabled={paying}>
              Remove
            </Button>
          </div>
        ) : (
          <form onSubmit={apply} className="flex items-end gap-2">
            <FormField
              label="Coupon code"
              htmlFor="checkout-coupon"
              className="flex-1"
              error={couponError ?? undefined}
            >
              <Input
                id="checkout-coupon"
                value={code}
                autoComplete="off"
                onChange={(event) => setCode(event.target.value)}
                placeholder="Optional"
              />
            </FormField>
            <Button
              type="submit"
              variant="secondary"
              loading={applying}
              disabled={!code.trim() || paying}
            >
              Apply
            </Button>
          </form>
        )}

        {replacesCurrentPlan && (
          <p className="text-sm text-slate-600">
            {plan.name} starts today. Any time left on your current plan isn't carried over.
          </p>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={paying}>
            Cancel
          </Button>
          <Button onClick={pay} loading={paying}>
            {due === 0 ? "Activate plan" : `Pay ${money(due)}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
