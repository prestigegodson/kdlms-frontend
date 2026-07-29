import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { getMySubscription, type SubscriptionSummaryView } from "@/api/subscriptions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
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
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Subscription</h1>

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner /> Loading subscription…
        </div>
      )}
      {state.kind === "error" && <Alert variant="error">{state.message}</Alert>}

      {state.kind === "loaded" && !state.summary.hasSubscription && (
        <EmptyState
          title="No active subscription"
          description="Contact your system administrator to have a plan assigned. The portal stays read-only until then."
        />
      )}

      {state.kind === "loaded" && state.summary.hasSubscription && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{state.summary.packageName}</p>
              <p className="text-sm text-gray-500">
                {formatDateRange(state.summary.startDate, state.summary.endDate)} ({state.summary.daysRemaining}{" "}
                days left)
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[state.summary.status]}>{state.summary.status}</Badge>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-gray-500">Billing cycle</dt>
            <dd className="text-gray-900">{state.summary.billingCycle}</dd>
            <dt className="text-gray-500">Price</dt>
            <dd className="text-gray-900">
              {state.summary.currency} {state.summary.price?.toFixed(2)}
            </dd>
            <dt className="text-gray-500">Branches</dt>
            <dd className="text-gray-900">
              {state.summary.branchesUsed} of {state.summary.multiBranch ? state.summary.branchLimit : 1}
            </dd>
            <dt className="text-gray-500">Active students</dt>
            <dd className="text-gray-900">
              {state.summary.activeStudentsUsed} of {state.summary.activeStudentLimit}
            </dd>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant={state.summary.multiBranch ? "success" : "neutral"}>
              {state.summary.multiBranch ? "Multi-branch" : "Single branch"}
            </Badge>
            <Badge variant={state.summary.quizSupport ? "success" : "neutral"}>
              {state.summary.quizSupport ? "Quiz support included" : "No quiz support"}
            </Badge>
            <Badge variant={state.summary.onDemandLearning ? "success" : "neutral"}>
              {state.summary.onDemandLearning ? "On-demand learning included" : "No on-demand learning"}
            </Badge>
          </div>
        </Card>
      )}
    </div>
  );
}
