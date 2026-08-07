import { Building2, CreditCard, GraduationCap, Layers, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMySubscription, type SubscriptionSummaryView } from "@/api/subscriptions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StatTile } from "@/components/ui/StatTile";
import { formatMoney } from "@/utils/currency";
import { formatDateRange } from "@/utils/date";

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

/**
 * Read-only self-service view of the school's own subscription: plan,
 * limits, current usage, and expiry. Subscriptions are activated/extended
 * manually by a system admin (CLAUDE.md's "manual subscription activation
 * (no payment gateway yet)"), so there's nothing to act on here.
 */
export function SubscriptionPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    getMySubscription()
      .then((summary) => setState({ kind: "loaded", summary }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: error instanceof ApiError ? error.message : "Failed to load subscription",
        }),
      );
  }, []);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Subscription" description="Your school's current plan, limits, and usage." />

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading subscription…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

      {state.kind === "loaded" && !state.summary.hasSubscription && (
        <EmptyState
          icon={CreditCard}
          title="No active subscription"
          description="Contact your system administrator to have a plan assigned. The portal stays read-only until then."
        />
      )}

      {state.kind === "loaded" && state.summary.hasSubscription && (
        <>
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{state.summary.packageName}</p>
                <p className="text-sm text-slate-500">
                  {formatDateRange(state.summary.startDate, state.summary.endDate)} (
                  {state.summary.daysRemaining} days left)
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[state.summary.status]}>{state.summary.status}</Badge>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Badge variant={state.summary.multiBranch ? "success" : "neutral"}>
                {state.summary.multiBranch ? "Multi-branch" : "Single branch"}
              </Badge>
              <Badge variant={state.summary.takeHomeQuiz ? "success" : "neutral"}>
                {state.summary.takeHomeQuiz ? "Take-home quizzes included" : "No take-home quizzes"}
              </Badge>
              <Badge variant={state.summary.onDemandLearning ? "success" : "neutral"}>
                {state.summary.onDemandLearning ? "On-demand learning included" : "No on-demand learning"}
              </Badge>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <StatTile icon={Layers} label="Billing cycle" value={state.summary.billingCycle} />
            <StatTile
              icon={Sparkles}
              label="Price"
              value={formatMoney(state.summary.price, state.summary.currency)}
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
    </div>
  );
}
