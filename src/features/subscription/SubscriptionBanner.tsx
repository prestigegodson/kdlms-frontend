import { useEffect, useState } from "react";
import { getMySubscription, type SubscriptionSummaryView } from "@/api/subscriptions";
import { Alert } from "@/components/ui/Alert";
import { formatLongDate } from "@/utils/date";

const EXPIRING_SOON_THRESHOLD_DAYS = 14;

/**
 * School-portal-wide plan/limits/expiry banner (plan.md Phase 2's exit
 * criterion). Deliberately renders nothing while loading, on a fetch
 * error, or when the plan is active and not close to expiry - it only
 * speaks up when there's something the school admin should act on.
 * Writes are already blocked server-side for an inactive subscription
 * (see shared.config.SubscriptionWriteGuardFilter); this is purely the
 * heads-up so that 403 isn't the first the admin hears of it.
 */
export function SubscriptionBanner() {
  const [summary, setSummary] = useState<SubscriptionSummaryView | null>(null);

  useEffect(() => {
    getMySubscription()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  if (!summary) {
    return null;
  }

  if (!summary.hasSubscription) {
    return (
      <Alert variant="error" className="mb-6">
        This school has no active subscription. Writes are disabled until a system admin assigns one.
      </Alert>
    );
  }

  if (summary.status === "EXPIRED") {
    return (
      <Alert variant="error" className="mb-6">
        The <strong>{summary.packageName}</strong> subscription expired on {formatLongDate(summary.endDate)}. Writes are
        disabled until it's renewed.
      </Alert>
    );
  }

  if (summary.status === "SUSPENDED" || summary.status === "CANCELLED") {
    return (
      <Alert variant="error" className="mb-6">
        The <strong>{summary.packageName}</strong> subscription is {summary.status.toLowerCase()}. Writes
        are disabled until a system admin resumes or reassigns it.
      </Alert>
    );
  }

  if (summary.daysRemaining <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return (
      <Alert variant="info" className="mb-6">
        The <strong>{summary.packageName}</strong> subscription expires in {summary.daysRemaining} day
        {summary.daysRemaining === 1 ? "" : "s"} ({formatLongDate(summary.endDate)}).
      </Alert>
    );
  }

  return null;
}
