import { CalendarDays } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuthStore } from "@/stores/authStore";
import { CreatorPlanCard } from "./components/CreatorPlanCard";
import { CreatorUpcomingSessions } from "./components/CreatorUpcomingSessions";

/**
 * The creator's landing page: their next sessions (Phase C7), their plan, and a way into their
 * classes (creators.md Phase C4).
 */
export function CreatorDashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="space-y-6">
      <PageHeader title={user ? `Welcome, ${user.firstName}` : "Dashboard"} />
      <CreatorUpcomingSessions />
      <CreatorPlanCard />
      <EmptyState
        icon={CalendarDays}
        title="Your classes"
        description="Create virtual classes, give each a weekly schedule, and manage their sessions."
        action={
          <Link
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
            to="/creator/classes"
          >
            Go to Classes
          </Link>
        }
      />
    </div>
  );
}
