import { useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type BillingSubscriptionView,
  cancelScheduledChange,
  setAutoRenew,
} from "@/api/subscriptionBilling";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Switch } from "@/components/ui/Switch";
import { formatMoney, fromMinor } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";
import { discountLabel, remainingLabel } from "../couponText";

interface CurrentSubscriptionCardProps {
  subscription: BillingSubscriptionView;
  /** A creator falls back to the Free plan; a school with no plan is read-only (Phase C10). */
  tenant: "CREATOR" | "SCHOOL";
  onChange: (subscription: BillingSubscriptionView) => void;
}

function cardText(subscription: BillingSubscriptionView): string | null {
  const card = subscription.card;
  if (!card?.last4) {
    return null;
  }
  const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : "Card";
  const expiry = card.expMonth && card.expYear ? ` · expires ${card.expMonth}/${card.expYear}` : "";
  return `${brand} ending ${card.last4}${expiry}`;
}

/**
 * The tenant's subscription as billing sees it (creators.md §6.1): what it costs, when it renews
 * or ends, the card it renews from, an auto-renew switch, and any scheduled downgrade. A plan the
 * system admin assigned for a bank transfer (`MANUAL`) with no card to renew from says how to
 * switch to card renewal instead of offering a switch that could only fail.
 */
export function CurrentSubscriptionCard({
  subscription,
  tenant,
  onChange,
}: CurrentSubscriptionCardProps) {
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!subscription.active) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Current plan</h2>
        <p className="mt-1 text-sm text-slate-500">
          {tenant === "SCHOOL"
            ? "Your school has no active plan, so the portal is read-only. Choose a plan below to restore full access."
            : "You're on the free plan. Choose a plan below to unlock more classes, learners and features."}
        </p>
      </Card>
    );
  }

  const paid = !subscription.free && subscription.endDate !== null;
  const card = cardText(subscription);
  const manualWithoutCard =
    subscription.source === "MANUAL" && !subscription.autoRenew && !subscription.card;

  async function run(action: () => Promise<BillingSubscriptionView>) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
    } catch (caught) {
      setError(getErrorMessage(caught, "Couldn't save your change. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Current plan</h2>
          <p className="mt-1 font-display text-xl font-medium text-slate-900">
            {subscription.planName}
          </p>
          {subscription.amountMinor != null && subscription.currency && (
            <p className="text-sm text-slate-600">
              {formatMoney(fromMinor(subscription.amountMinor), subscription.currency)}
              {subscription.billingCycle === "ANNUAL" ? " a year" : " a month"}
            </p>
          )}
          <p className="text-sm text-slate-500">
            {!subscription.endDate
              ? "No end date"
              : subscription.autoRenew
                ? `Renews ${formatLongDate(subscription.endDate)}`
                : `Ends ${formatLongDate(subscription.endDate)}`}
          </p>
        </div>
        {subscription.free ? (
          <Badge variant="success">Free</Badge>
        ) : (
          subscription.source === "MANUAL" && <Badge variant="info">Assigned by KDLMS</Badge>
        )}
      </div>

      {subscription.renewalPending && subscription.graceUntil && (
        <Alert variant="warning" className="mt-4" title="We couldn't renew your plan">
          Your saved card was declined. We'll keep trying, and your plan stays active until{" "}
          {formatLongDate(subscription.graceUntil)}. To keep it without interruption, pay again with
          another card below.
        </Alert>
      )}

      {subscription.scheduledPlanName && (
        <Alert variant="info" className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              You'll move to <strong>{subscription.scheduledPlanName}</strong> when this plan renews
              on {formatLongDate(subscription.endDate)}.
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => run(cancelScheduledChange)}
            >
              Keep {subscription.planName}
            </Button>
          </div>
        </Alert>
      )}

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      {paid && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {card && <p className="text-sm text-slate-600">Renews from {card}</p>}
          {subscription.coupon && (
            <p className="text-sm text-slate-600">
              Coupon <span className="font-mono">{subscription.coupon.code}</span>:{" "}
              {discountLabel(
                subscription.coupon.type,
                subscription.coupon.value,
                subscription.coupon.currency,
              )}{" "}
              {remainingLabel(subscription.coupon.periodsRemaining)}
            </p>
          )}
          {manualWithoutCard ? (
            <p className="text-sm text-slate-600">
              This plan was assigned by KDLMS and ends on its end date. To renew automatically
              instead, pay for a plan by card below.
            </p>
          ) : (
            <Switch
              checked={subscription.autoRenew}
              label="Renew automatically"
              hint={
                subscription.autoRenew
                  ? "We'll charge your saved card at the end of each period."
                  : "Your plan will end on its end date."
              }
              disabled={busy}
              onChange={(next) => (next ? run(() => setAutoRenew(true)) : setConfirmingStop(true))}
            />
          )}
        </div>
      )}

      {confirmingStop && (
        <ConfirmDialog
          title="Turn off auto-renewal?"
          message={`Your plan stays active until ${formatLongDate(subscription.endDate)} and then ends. You can turn auto-renewal back on any time before then.`}
          confirmLabel="Turn off"
          onConfirm={async () => {
            onChange(await setAutoRenew(false));
          }}
          onClose={() => setConfirmingStop(false)}
        />
      )}
    </Card>
  );
}
