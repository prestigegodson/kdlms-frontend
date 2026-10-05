import { CalendarDays, CreditCard, Home, MessageSquare, Presentation, UserRound, Users } from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { VerifyEmailBanner } from "@/features/creators/components/VerifyEmailBanner";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";
import { useCreatorPlanStore } from "@/stores/creatorPlanStore";

/**
 * The education-creator portal (creators.md Phase C1; Classes and Sessions since C4, Learners since
 * C5, Plan & billing since C8, Messages since C11). The tab bar holds four primary items, so
 * Learners, Messages and Plan & billing live in the More drawer.
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/creator", icon: Home, primary: ["CREATOR"] },
  {
    label: "Classes",
    href: "/creator/classes",
    icon: Presentation,
    primary: ["CREATOR"],
    visible: () => can.manageVirtualClasses("CREATOR"),
  },
  {
    label: "Sessions",
    href: "/creator/sessions",
    icon: CalendarDays,
    primary: ["CREATOR"],
    visible: () => can.manageVirtualClasses("CREATOR"),
  },
  {
    label: "Learners",
    href: "/creator/learners",
    icon: Users,
    visible: () => can.manageLearners("CREATOR"),
  },
  {
    label: "Messages",
    href: "/creator/messages",
    icon: MessageSquare,
    // Gated on the creator's own plan (creators.md Phase C11) - see auth/permissions.ts's
    // viewClassMessages.
    visible: () => can.viewClassMessages("CREATOR", useCreatorPlanStore.getState().plan?.communication ?? false),
    badge: () => useClassMessagesUnreadStore.getState().count,
  },
  {
    label: "Plan & billing",
    href: "/creator/billing",
    icon: CreditCard,
    visible: () => can.manageSubscriptionBilling("CREATOR"),
  },
  {
    label: "Profile",
    href: "/creator/profile",
    icon: UserRound,
    primary: ["CREATOR"],
    visible: () => can.manageCreatorProfile("CREATOR"),
  },
];

export function CreatorLayout() {
  const fetchPlan = useCreatorPlanStore((state) => state.fetchIfNeeded);
  const fetchUnread = useClassMessagesUnreadStore((state) => state.fetchIfNeeded);
  // Subscribed only to re-render once the fetches resolve, so the Messages item's visible()/badge()
  // closures re-evaluate - the GuardianLayout pattern.
  useCreatorPlanStore((state) => state.plan);
  useClassMessagesUnreadStore((state) => state.count);

  useEffect(() => {
    fetchPlan();
    fetchUnread("CREATOR");
  }, [fetchPlan, fetchUnread]);

  return <PortalShell portalName="Creator" navItems={NAV_ITEMS} banner={<VerifyEmailBanner />} />;
}
