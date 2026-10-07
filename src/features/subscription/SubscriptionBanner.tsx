import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { getMySubscription, type SubscriptionSummaryView } from "@/api/subscriptions";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { useAuthStore } from "@/stores/authStore";
import { formatLongDate } from "@/utils/date";

const EXPIRING_SOON_THRESHOLD_DAYS = 14;

/**
 * School-portal-wide plan/limits/expiry banner (plan.md Phase 2's exit
 * criterion). Deliberately renders nothing while loading, on a fetch
 * error, or when the plan is active and not close to expiry - it only
 * speaks up when there's something the school admin should act on.
 * Writes are already blocked server-side for an inactive subscription
 * (see shared.config.SubscriptionWriteGuardFilter); this is purely the
 * heads-up so that 403 isn't the first the admin hears of it. Since
 * Phase C10 a school admin can pay for the plan themselves, so they get a
 * link to Subscription & billing; everyone else is told to ask them. A
 * freemium school is writable whatever its plan and never pays, so it gets
 * no banner at all.
 */
export function SubscriptionBanner() {
  const role = useAuthStore((state) => state.user?.role);
  const [summary, setSummary] = useState<SubscriptionSummaryView | null>(null);

  useEffect(() => {
    getMySubscription()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  if (!summary || summary.freemium) {
    return null;
  }

  const canPay = can.manageSubscriptionBilling(role);
  const action = (label: string): ReactNode =>
    canPay ? (
      <>
        {" "}
        <Link to="/school/subscription" className="font-medium underline">
          {label}
        </Link>
      </>
    ) : (
      " Please ask your school admin to renew it."
    );

  if (!summary.hasSubscription) {
    return (
      <Alert variant="error" className="mb-6">
        This school has no active subscription, so writes are disabled.
        {action("Choose a plan")}
      </Alert>
    );
  }

  if (summary.status === "EXPIRED") {
    return (
      <Alert variant="error" className="mb-6">
        The <strong>{summary.packageName}</strong> subscription expired on{" "}
        {formatLongDate(summary.endDate)}, so writes are disabled.
        {action("Renew now")}
      </Alert>
    );
  }

  if (summary.status === "SUSPENDED" || summary.status === "CANCELLED") {
    return (
      <Alert variant="error" className="mb-6">
        The <strong>{summary.packageName}</strong> subscription is {summary.status.toLowerCase()}.
        Writes are disabled until a system admin resumes it, or a new plan is bought.
        {canPay && action("Choose a plan")}
      </Alert>
    );
  }

  if (summary.graceUntil) {
    return (
      <Alert variant="warning" className="mb-6">
        We couldn't renew the <strong>{summary.packageName}</strong> subscription. It stays active
        until {formatLongDate(summary.graceUntil)} while we retry the card.
        {action("Update payment")}
      </Alert>
    );
  }

  // A plan that renews from a saved card needs nothing doing before it ends.
  if (
    !summary.autoRenew &&
    summary.daysRemaining != null &&
    summary.daysRemaining <= EXPIRING_SOON_THRESHOLD_DAYS
  ) {
    return (
      <Alert variant="info" className="mb-6">
        The <strong>{summary.packageName}</strong> subscription expires in {summary.daysRemaining}{" "}
        {summary.daysRemaining === 1 ? "day" : "days"} ({formatLongDate(summary.endDate)}).
        {canPay && action("Renew now")}
      </Alert>
    );
  }

  return null;
}
