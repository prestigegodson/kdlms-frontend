import { Building2, CreditCard, GraduationCap, Layers, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMySubscription, type SubscriptionSummaryView } from "@/api/subscriptions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatTile } from "@/components/ui/StatTile";
import { PlanBillingSections } from "@/features/subscriptionBilling/components/PlanBillingSections";
import { formatMoney, fromMinor } from "@/utils/currency";
import { formatDateRange, formatLongDate } from "@/utils/date";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; summary: SubscriptionSummaryView }
  | { kind: "error"; message: string };

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  EXPIRED: "danger",
  CANCELLED: "neutral",
  NONE: "neutral",
};

interface SubscriptionPageProps {
  /** Where to send the browser for payment - `window.location.assign` outside tests. */
  redirect?: (url: string) => void;
}

/**
 * "Subscription & billing" (creators.md Phase C10): the school's own plan,
 * limits, current usage, and expiry, followed by the same plan billing a
 * creator gets - auto-renewal, the SCHOOL plans it can buy through
 * Paystack, and its payment history - so a school admin can pay for and
 * renew the subscription without the system admin. A plan the system
 * admin assigned for a bank transfer still shows here, as `MANUAL`.
 */
export function SubscriptionPage({ redirect }: SubscriptionPageProps) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(() => {
    getMySubscription()
      .then((summary) => setState({ kind: "loaded", summary }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load subscription",
        }),
      );
  }, []);

  useEffect(load, [load]);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Subscription & billing"
        description="Your school's plan, limits and usage, how it renews, and what you've paid."
      />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading subscription…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

      {state.kind === "loaded" && !state.summary.hasSubscription && (
        <EmptyState
          icon={CreditCard}
          title="No active plan"
          description="Choose a plan below. The portal stays read-only until your school has one."
        />
      )}

      {state.kind === "loaded" && state.summary.hasSubscription && (
        <>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{state.summary.packageName}</p>
                <p className="text-sm text-slate-500">
                  {state.summary.freemium
                    ? `Since ${formatLongDate(state.summary.startDate)}`
                    : `${formatDateRange(state.summary.startDate, state.summary.endDate)} (${state.summary.daysRemaining} days left)`}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[state.summary.status]}>{state.summary.status}</Badge>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant={state.summary.multiBranch ? "success" : "neutral"}>
                {state.summary.multiBranch ? "Multi-branch" : "Single branch"}
              </Badge>
              <Badge variant={state.summary.takeHomeQuiz ? "success" : "neutral"}>
                {state.summary.takeHomeQuiz ? "CBT/Quizzes included" : "No CBT/Quizzes"}
              </Badge>
              <Badge variant={state.summary.onDemandLearning ? "success" : "neutral"}>
                {state.summary.onDemandLearning ? "On-demand learning included" : "No on-demand learning"}
              </Badge>
              <Badge variant={state.summary.communication ? "success" : "neutral"}>
                {state.summary.communication ? "Home-school communication included" : "No home-school communication"}
              </Badge>
              <Badge variant={state.summary.timetable ? "success" : "neutral"}>
                {state.summary.timetable ? "Timetables included" : "No timetables"}
              </Badge>
              <Badge variant={state.summary.lessonNotes ? "success" : "neutral"}>
                {state.summary.lessonNotes ? "Lesson notes included" : "No lesson notes"}
              </Badge>
              <Badge variant={state.summary.aiLessonNotes ? "success" : "neutral"}>
                {state.summary.aiLessonNotes ? "AI lesson notes included" : "No AI lesson notes"}
              </Badge>
              <Badge variant={state.summary.billing ? "success" : "neutral"}>
                {state.summary.billing ? "Fees & bills included" : "No fees & bills"}
              </Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile icon={Layers} label="Billing cycle" value={state.summary.billingCycle} />
            <StatTile
              icon={Sparkles}
              label="Price"
              value={
                state.summary.prices.length === 0
                  ? "—"
                  : state.summary.prices
                      .map((price) => formatMoney(fromMinor(price.amountMinor), price.currency))
                      .join(" / ")
              }
            />
            <StatTile
              icon={Building2}
              label="Branches"
              value={`${state.summary.branchesUsed} / ${state.summary.multiBranch ? state.summary.branchLimit : 1}`}
            />
            <StatTile
              icon={GraduationCap}
              label="Active students"
              value={`${state.summary.activeStudentsUsed} / ${state.summary.activeStudentLimit}`}
            />
          </div>
        </>
      )}

      <PlanBillingSections redirect={redirect} onChanged={load} />
    </div>
  );
}
