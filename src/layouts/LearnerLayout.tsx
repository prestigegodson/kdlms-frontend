import { MessageSquare, Presentation } from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";

/**
 * The learner portal (creators.md Phase C5): a LEARNER's own online classes across every creator
 * they learn with, and (Phase C11) Messages; resources and quizzes arrive with the later content
 * phases (C12-C14). No feature flags to fetch: a learner's token carries no school, and each tutor's
 * plan is checked per class by the server.
 */
const NAV_ITEMS: NavItem[] = [
  {
    label: "My classes",
    href: "/learner",
    icon: Presentation,
    primary: ["LEARNER"],
    visible: () => can.viewLearnerPortal("LEARNER"),
  },
  {
    label: "Messages",
    href: "/learner/messages",
    icon: MessageSquare,
    primary: ["LEARNER"],
    visible: () => can.viewClassMessages("LEARNER", true),
    badge: () => useClassMessagesUnreadStore.getState().count,
  },
];

export function LearnerLayout() {
  const fetchUnread = useClassMessagesUnreadStore((state) => state.fetchIfNeeded);
  useClassMessagesUnreadStore((state) => state.count);

  useEffect(() => {
    fetchUnread("LEARNER");
  }, [fetchUnread]);

  return <PortalShell portalName="Learner" navItems={NAV_ITEMS} />;
}
