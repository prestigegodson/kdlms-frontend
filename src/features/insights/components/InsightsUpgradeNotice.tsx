import { Link } from "react-router";
import { Alert } from "@/components/ui/Alert";
import { useAuthStore } from "@/stores/authStore";

/**
 * Shown in place of an insights page when the school's package lacks `studentInsights` - either
 * known up front from the feature store, or learned from a `feature-not-included` 403 (a downgrade
 * the store hasn't revalidated yet). Only a SCHOOL_ADMIN can open the subscription page, so only
 * they get the link.
 */
export function InsightsUpgradeNotice() {
  const role = useAuthStore((state) => state.user?.role);
  return (
    <Alert variant="info" title="Student insights aren't in your plan">
      Upgrade your subscription to see which students are slipping, why, and when it was last checked.
      {role === "SCHOOL_ADMIN" && (
        <>
          {" "}
          <Link to="/school/subscription" className="font-medium underline">
            See plans
          </Link>
        </>
      )}
    </Alert>
  );
}
