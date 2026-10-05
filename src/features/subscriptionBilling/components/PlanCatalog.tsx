import { useState } from "react";
import type { PackageView } from "@/api/packages";
import type { BillingSubscriptionView, CheckoutResult } from "@/api/subscriptionBilling";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Select } from "@/components/ui/Select";
import {
  formatMoney,
  fromMinor,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@/utils/currency";
import { formatLongDate } from "@/utils/date";
import { CheckoutDialog } from "./CheckoutDialog";

interface PlanCatalogProps {
  plans: PackageView[];
  subscription: BillingSubscriptionView;
  currency: SupportedCurrency;
  onCurrencyChange: (currency: SupportedCurrency) => void;
  /**
   * A downgrade was scheduled, or a coupon covering the whole price activated the plan - nothing
   * to pay at Paystack, so the caller reloads the subscription.
   */
  onChanged: () => void;
  /** Where to send the browser for payment - `window.location.assign` outside tests. */
  redirect?: (url: string) => void;
}

function priceOf(plan: PackageView, currency: SupportedCurrency): number | null {
  return plan.prices.find((price) => price.currency === currency)?.amountMinor ?? null;
}

function limit(value: number | null, unit: string): string {
  return value == null ? `Unlimited ${unit}` : `${value} ${unit}`;
}

function highlights(plan: PackageView): string[] {
  if (plan.audience === "SCHOOL") {
    return [
      plan.activeStudentLimit == null
        ? "Unlimited students"
        : `${plan.activeStudentLimit} students`,
      `${plan.branchLimit} ${plan.branchLimit === 1 ? "branch" : "branches"}`,
    ];
  }
  const items = [
    limit(plan.maxClasses, "classes"),
    limit(plan.maxStudentsPerClass, "learners per class"),
    plan.maxSessionMinutes == null
      ? "Unlimited session length"
      : `${plan.maxSessionMinutes}-minute sessions`,
  ];
  if (plan.guardianAccess) items.push("Guardian access");
  if (plan.lessonNotes) items.push("Lesson notes");
  if (plan.takeHomeQuiz) items.push("Quizzes");
  if (plan.onDemandLearning) items.push("Learning resources");
  if (plan.communication) items.push("Class messaging");
  return items;
}

/**
 * The plans this tenant can buy (creators.md §6.1), priced in the chosen currency. Choosing one
 * starts a Paystack checkout - the server prices it - or, for a plan cheaper than a running paid
 * one, schedules the switch for the next renewal.
 */
export function PlanCatalog({
  plans,
  subscription,
  currency,
  onCurrencyChange,
  onChanged,
  redirect = (url) => window.location.assign(url),
}: PlanCatalogProps) {
  const [choosing, setChoosing] = useState<{ plan: PackageView; price: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sorted = [...plans].sort(
    (a, b) => (priceOf(a, currency) ?? 0) - (priceOf(b, currency) ?? 0),
  );
  const periodRunning =
    subscription.source === "PAYSTACK" &&
    !subscription.renewalPending &&
    subscription.endDate !== null;

  /**
   * Whether buying `plan` ends a paid plan that still has time left. A cheaper plan than a
   * running Paystack one is a downgrade the server schedules for the renewal instead.
   */
  function replacesCurrentPlan(plan: PackageView, price: number): boolean {
    if (!subscription.active || subscription.free || subscription.endDate === null) return false;
    if (plan.id === subscription.packageId) return false;
    const current = plans.find((candidate) => candidate.id === subscription.packageId);
    const currentPrice = current ? priceOf(current, currency) : null;
    const downgrade = periodRunning && currentPrice !== null && price < currentPrice;
    return !downgrade;
  }

  function onResult(plan: PackageView, result: CheckoutResult) {
    if (result.authorizationUrl) {
      redirect(result.authorizationUrl);
      return;
    }
    setChoosing(null);
    if (result.scheduled) {
      setNotice(
        `${plan.name} will start when your current plan renews on ${formatLongDate(subscription.endDate)}.`,
      );
    } else if (result.activated) {
      setNotice(`Your coupon covered the full price - ${plan.name} is now active.`);
    }
    onChanged();
  }

  return (
    <section aria-labelledby="plan-catalog-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="plan-catalog-heading" className="text-base font-semibold text-slate-900">
            Plans
          </h2>
          <p className="text-sm text-slate-500">Pay securely by card through Paystack.</p>
        </div>
        <FormField label="Currency" htmlFor="plan-currency" className="w-32">
          <Select
            id="plan-currency"
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value as SupportedCurrency)}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {!subscription.paymentsAvailable && (
        <Alert variant="warning">
          Online payments aren't available right now. Please try again later.
        </Alert>
      )}
      {notice && <Alert variant="success">{notice}</Alert>}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((plan) => {
          const price = priceOf(plan, currency);
          const current = subscription.active && plan.id === subscription.packageId;
          const scheduled = plan.id === subscription.scheduledPackageId;
          let disabledReason: string | null = null;
          if (plan.free) disabledReason = current ? "Your current plan" : "Included free";
          else if (price == null) disabledReason = `Not available in ${currency}`;
          else if (current && periodRunning) disabledReason = "Your current plan";
          else if (scheduled) disabledReason = "Starts at renewal";
          else if (!subscription.paymentsAvailable) disabledReason = "Unavailable";

          return (
            <li key={plan.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-medium text-slate-900">{plan.name}</h3>
                  {current && <Badge variant="brand">Current</Badge>}
                </div>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {plan.free
                    ? "Free"
                    : price == null
                      ? "—"
                      : formatMoney(fromMinor(price), currency)}
                  {!plan.free && price != null && (
                    <span className="text-sm font-normal text-slate-500">
                      {plan.billingCycle === "ANNUAL" ? " / year" : " / month"}
                    </span>
                  )}
                </p>
                {plan.description && (
                  <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                )}
                <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-700">
                  {highlights(plan).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <Button
                  className="mt-4 w-full"
                  variant={current ? "secondary" : "primary"}
                  disabled={disabledReason !== null}
                  onClick={() => {
                    setNotice(null);
                    if (price != null) setChoosing({ plan, price });
                  }}
                >
                  {disabledReason ?? (current ? "Renew now" : `Choose ${plan.name}`)}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>

      {choosing && (
        <CheckoutDialog
          plan={choosing.plan}
          currency={currency}
          priceMinor={choosing.price}
          replacesCurrentPlan={replacesCurrentPlan(choosing.plan, choosing.price)}
          onClose={() => setChoosing(null)}
          onResult={(result) => onResult(choosing.plan, result)}
        />
      )}
    </section>
  );
}
