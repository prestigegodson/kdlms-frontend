import { useState } from "react";
import type { BillingCycle, PackageView } from "@/api/packages";
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
import { cyclesOf, priceFor } from "@/utils/planPricing";
import { CheckoutDialog } from "./CheckoutDialog";

interface PlanCatalogProps {
  plans: PackageView[];
  subscription: BillingSubscriptionView;
  currency: SupportedCurrency;
  /** The currencies the picker offers - every supported one unless narrowed (a tutor's). */
  currencies?: readonly SupportedCurrency[];
  onCurrencyChange: (currency: SupportedCurrency) => void;
  /**
   * A downgrade was scheduled, or a coupon covering the whole price activated the plan - nothing
   * to pay at Paystack, so the caller reloads the subscription.
   */
  onChanged: () => void;
  /** Where to send the browser for payment - `window.location.assign` outside tests. */
  redirect?: (url: string) => void;
}

const MONTHS: Record<BillingCycle, number> = { MONTHLY: 1, ANNUAL: 12 };

const CYCLE_OPTIONS: Array<{ value: BillingCycle; label: string }> = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

/** What paying annually saves over twelve monthly payments, as a whole percentage - null if nothing. */
function annualSaving(plan: PackageView, currency: SupportedCurrency): number | null {
  const monthly = priceFor(plan, "MONTHLY", currency);
  const annual = priceFor(plan, "ANNUAL", currency);
  if (monthly == null || annual == null || monthly === 0) return null;
  const saving = Math.round((1 - annual / (monthly * 12)) * 100);
  return saving > 0 ? saving : null;
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
  const items = [limit(plan.maxClasses, "classes"), limit(plan.maxStudentsPerClass, "learners per class")];
  if (plan.platformVideo) {
    items.push("Platform Video Conferencing");
    items.push(
      plan.maxSessionMinutes == null ? "Unlimited session length" : `${plan.maxSessionMinutes}-minute sessions`,
    );
  } else {
    items.push("Sessions on your own Google Meet or Zoom link");
  }
  if (plan.guardianAccess) items.push("Guardian access");
  if (plan.lessonNotes) items.push("Lesson notes");
  if (plan.takeHomeQuiz) items.push("Quizzes");
  if (plan.takeHomeQuiz && plan.interactiveQuestions) items.push("Interactive questions");
  if (plan.onDemandLearning) items.push("Learning resources");
  if (plan.communication) items.push("Class messaging");
  return items;
}

/**
 * The plans this tenant can buy (creators.md §6.1), priced in the chosen currency and billing
 * cycle - a Monthly/Annual toggle appears when the plans are sold on both. Choosing one starts a
 * Paystack checkout - the server prices it - or, for a plan cheaper per month than a running paid
 * one (the same plan moving from annual to monthly billing included), schedules the switch for the
 * next renewal.
 */
export function PlanCatalog({
  plans,
  subscription,
  currency,
  currencies = SUPPORTED_CURRENCIES,
  onCurrencyChange,
  onChanged,
  redirect = (url) => window.location.assign(url),
}: PlanCatalogProps) {
  const offeredCycles = CYCLE_OPTIONS.map((option) => option.value).filter((value) =>
    plans.some((plan) => cyclesOf(plan).includes(value)),
  );
  const [cycle, setCycle] = useState<BillingCycle>(() =>
    subscription.active &&
    !subscription.free &&
    subscription.billingCycle &&
    offeredCycles.includes(subscription.billingCycle)
      ? subscription.billingCycle
      : (offeredCycles[0] ?? "MONTHLY"),
  );
  const [choosing, setChoosing] = useState<{
    plan: PackageView;
    cycle: BillingCycle;
    price: number;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sorted = [...plans].sort(
    (a, b) => (priceFor(a, cycle, currency) ?? 0) - (priceFor(b, cycle, currency) ?? 0),
  );
  const periodRunning =
    subscription.source === "PAYSTACK" &&
    !subscription.renewalPending &&
    subscription.endDate !== null;
  const currentPlan = plans.find((candidate) => candidate.id === subscription.packageId);
  const currentCycle = subscription.billingCycle ?? currentPlan?.billingCycle ?? null;
  const scheduledCycle =
    subscription.scheduledBillingCycle ??
    plans.find((candidate) => candidate.id === subscription.scheduledPackageId)?.billingCycle ??
    null;

  /**
   * Whether buying `plan` on `planCycle` ends a paid plan that still has time left. A plan cheaper
   * per month than a running Paystack one - or the same plan moving from annual to monthly - is a
   * downgrade the server schedules for the renewal instead.
   */
  function replacesCurrentPlan(plan: PackageView, planCycle: BillingCycle, price: number): boolean {
    if (!subscription.active || subscription.free || subscription.endDate === null) return false;
    if (plan.id === subscription.packageId) {
      if (planCycle === currentCycle) return false;
      return !(periodRunning && planCycle === "MONTHLY");
    }
    const currentPrice =
      currentPlan && currentCycle ? priceFor(currentPlan, currentCycle, currency) : null;
    const downgrade =
      periodRunning &&
      currentPrice !== null &&
      currentCycle !== null &&
      price * MONTHS[currentCycle] < currentPrice * MONTHS[planCycle];
    return !downgrade;
  }

  function onResult(plan: PackageView, planCycle: BillingCycle, result: CheckoutResult) {
    if (result.authorizationUrl) {
      redirect(result.authorizationUrl);
      return;
    }
    setChoosing(null);
    if (result.scheduled) {
      const billed =
        offeredCycles.length > 1 ? ` (${planCycle === "ANNUAL" ? "annual" : "monthly"} billing)` : "";
      setNotice(
        `${plan.name}${billed} will start when your current plan renews on ${formatLongDate(subscription.endDate)}.`,
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
        <div className="flex flex-wrap items-end gap-3">
          {offeredCycles.length > 1 && (
            <div
              role="radiogroup"
              aria-label="Billing cycle"
              className="inline-flex rounded-control border border-slate-200 bg-white p-1"
            >
              {CYCLE_OPTIONS.map((option) => {
                const selected = cycle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCycle(option.value)}
                    className={`cursor-pointer rounded-control px-3 py-1.5 text-sm font-medium mobile:min-h-11 ${
                      selected ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
          <FormField label="Currency" htmlFor="plan-currency" className="w-32">
            <Select
              id="plan-currency"
              value={currency}
              onChange={(event) => onCurrencyChange(event.target.value as SupportedCurrency)}
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      {!subscription.paymentsAvailable && (
        <Alert variant="warning">
          Online payments aren't available right now. Please try again later.
        </Alert>
      )}
      {notice && <Alert variant="success">{notice}</Alert>}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((plan) => {
          const price = priceFor(plan, cycle, currency);
          const onThisPlan = subscription.active && plan.id === subscription.packageId;
          const current = onThisPlan && (plan.free || cycle === currentCycle);
          const scheduled = plan.id === subscription.scheduledPackageId && cycle === scheduledCycle;
          const otherCycle: BillingCycle = cycle === "ANNUAL" ? "MONTHLY" : "ANNUAL";
          const saving = cycle === "ANNUAL" ? annualSaving(plan, currency) : null;
          let disabledReason: string | null = null;
          if (plan.free) disabledReason = current ? "Your current plan" : "Included free";
          else if (price == null)
            disabledReason =
              priceFor(plan, otherCycle, currency) != null
                ? otherCycle === "ANNUAL"
                  ? "Annual billing only"
                  : "Monthly billing only"
                : `Not available in ${currency}`;
          else if (current && periodRunning) disabledReason = "Your current plan";
          else if (scheduled) disabledReason = "Starts at renewal";
          else if (!subscription.paymentsAvailable) disabledReason = "Unavailable";
          const action = current
            ? "Renew now"
            : onThisPlan
              ? `Switch to ${cycle === "ANNUAL" ? "annual" : "monthly"} billing`
              : `Choose ${plan.name}`;

          return (
            <li key={plan.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-medium text-slate-900">{plan.name}</h3>
                  <div className="flex flex-wrap justify-end gap-1">
                    {saving != null && <Badge variant="success">Save {saving}%</Badge>}
                    {current && <Badge variant="brand">Current</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {plan.free
                    ? "Free"
                    : price == null
                      ? "—"
                      : formatMoney(fromMinor(price), currency)}
                  {!plan.free && price != null && (
                    <span className="text-sm font-normal text-slate-500">
                      {cycle === "ANNUAL" ? " / year" : " / month"}
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
                    if (price != null) setChoosing({ plan, cycle, price });
                  }}
                >
                  {disabledReason ?? action}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>

      {choosing && (
        <CheckoutDialog
          plan={choosing.plan}
          cycle={choosing.cycle}
          currency={currency}
          priceMinor={choosing.price}
          replacesCurrentPlan={replacesCurrentPlan(choosing.plan, choosing.cycle, choosing.price)}
          onClose={() => setChoosing(null)}
          onResult={(result) => onResult(choosing.plan, choosing.cycle, result)}
        />
      )}
    </section>
  );
}
