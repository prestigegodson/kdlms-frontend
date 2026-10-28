import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import { getMyCreatorProfile } from "@/api/creators";
import type { PackageView } from "@/api/packages";
import {
  type BillingSubscriptionView,
  getBillingSubscription,
  listBillablePlans,
} from "@/api/subscriptionBilling";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { tutorCurrencyOptions, useTutorCurrencies } from "@/features/creators/hooks/useTutorCurrencies";
import { useAuthStore } from "@/stores/authStore";
import type { SupportedCurrency } from "@/utils/currency";
import { CurrentSubscriptionCard } from "./CurrentSubscriptionCard";
import { PlanCatalog } from "./PlanCatalog";
import { TransactionHistory } from "./TransactionHistory";

type State =
  | { kind: "loading" }
  | { kind: "loaded"; plans: PackageView[]; subscription: BillingSubscriptionView }
  | { kind: "error"; message: string };

interface PlanBillingSectionsProps {
  /** Where to send the browser for payment - `window.location.assign` outside tests. */
  redirect?: (url: string) => void;
  /** Anything about the subscription changed here - a caller showing more of it reloads. */
  onChanged?: () => void;
}

/**
 * The tenant's own plan billing (creators.md §6.1): its current plan and auto-renewal, the plans
 * it can buy through Paystack, and its payment history. Shared by the creator's Plan & billing
 * page (Phase C8) and the school admin's Subscription & billing page (Phase C10) - the server
 * scopes everything to the caller's tenant and offers only plans of its own audience. Prices
 * default to the subscription's currency, else a creator's preferred one (while the system admin
 * still offers it to tutors), else the tutors' default currency, else NGN. A creator's picker offers
 * only the tutor currencies, plus the subscription's own if it has since been switched off.
 */
export function PlanBillingSections({ redirect, onChanged }: PlanBillingSectionsProps) {
  const role = useAuthStore((state) => state.user?.role);
  const [state, setState] = useState<State>({ kind: "loading" });
  const isCreator = role === "CREATOR";
  const [chosenCurrency, setChosenCurrency] = useState<SupportedCurrency | null>(null);
  const [profileCurrency, setProfileCurrency] = useState<SupportedCurrency | null>(null);
  const tutorCurrencies = useTutorCurrencies(isCreator);

  const load = useCallback(() => {
    Promise.all([listBillablePlans(), getBillingSubscription()])
      .then(([plans, subscription]) => {
        setState({ kind: "loaded", plans, subscription });
        if (subscription.currency) {
          setChosenCurrency(subscription.currency);
        }
      })
      .catch((error: unknown) =>
        setState({ kind: "error", message: getErrorMessage(error, "Failed to load your plan") }),
      );
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!isCreator) return;
    let cancelled = false;
    getMyCreatorProfile()
      .then((profile) => {
        if (!cancelled) {
          setProfileCurrency(profile.currency);
        }
      })
      .catch(() => {
        // No profile yet - keep the default currency.
      });
    return () => {
      cancelled = true;
    };
  }, [isCreator]);

  const profileCurrencyOffered =
    profileCurrency != null && (!tutorCurrencies || tutorCurrencies.enabled.includes(profileCurrency));
  const currency: SupportedCurrency =
    chosenCurrency ??
    (profileCurrencyOffered ? profileCurrency : null) ??
    tutorCurrencies?.defaultCurrency ??
    "NGN";

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your plan…
        </div>
      </Card>
    );
  }
  if (state.kind === "error") {
    return <Alert variant="error">{state.message}</Alert>;
  }
  return (
    <>
      <CurrentSubscriptionCard
        subscription={state.subscription}
        tenant={role === "CREATOR" ? "CREATOR" : "SCHOOL"}
        onChange={(subscription) => {
          setState({ ...state, subscription });
          onChanged?.();
        }}
      />
      <PlanCatalog
        plans={state.plans}
        subscription={state.subscription}
        currency={currency}
        currencies={isCreator ? tutorCurrencyOptions(tutorCurrencies, state.subscription.currency) : undefined}
        onCurrencyChange={setChosenCurrency}
        onChanged={() => {
          load();
          onChanged?.();
        }}
        redirect={redirect}
      />
      <TransactionHistory />
    </>
  );
}
