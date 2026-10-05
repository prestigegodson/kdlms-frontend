import { PageHeader } from "@/components/ui/PageHeader";
import { PlanBillingSections } from "./components/PlanBillingSections";

interface PlanBillingPageProps {
  redirect?: (url: string) => void;
}

/**
 * The creator's "Plan & billing" (creators.md §6.1, Phase C8): the tenant's current plan and
 * auto-renewal, the plans it can buy through Paystack, and its payment history. A school admin
 * gets the same sections on Subscription & billing (Phase C10), below their usage.
 */
export function PlanBillingPage({ redirect }: PlanBillingPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan & billing"
        description="Your plan, how it renews, and what you've paid."
      />
      <PlanBillingSections redirect={redirect} />
    </div>
  );
}
