import { Navigate } from "react-router";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

/**
 * `/billing` - the link the payment emails and the callback page use, so they needn't know the
 * tenant's portal. A creator lands on their Plan & billing page and a school admin on Subscription
 * & billing (Phase C10); anyone else lands on their portal home.
 */
export function BillingHomeRedirect() {
  const role = useAuthStore((state) => state.user?.role);
  if (role === "CREATOR") {
    return <Navigate to="/creator/billing" replace />;
  }
  if (role === "SCHOOL_ADMIN") {
    return <Navigate to="/school/subscription" replace />;
  }
  return <Navigate to={role ? homePathForRole(role) : "/login"} replace />;
}
