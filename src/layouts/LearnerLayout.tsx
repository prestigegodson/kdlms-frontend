import { BookOpen, ClipboardCheck, MessageSquare, NotebookPen, Presentation } from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";

/**
 * The learner portal (creators.md Phase C5): a LEARNER's own online classes across every creator
 * they learn with, (Phase C11) Messages, (Phase C12) Lesson notes, (Phase C13) Quizzes and (Phase
 * C14) Resources. No feature flags to fetch: a learner's token carries no school, and each tutor's
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
  {
    label: "Lesson notes",
    href: "/learner/lesson-notes",
    icon: NotebookPen,
    primary: ["LEARNER"],
    visible: () => can.viewClassLessonNotes("LEARNER", true),
  },
  {
    label: "Quizzes",
    href: "/learner/quizzes",
    icon: ClipboardCheck,
    primary: ["LEARNER"],
    visible: () => can.viewClassQuizzes("LEARNER", true),
  },
  {
    label: "Resources",
    href: "/learner/resources",
    icon: BookOpen,
    // Overflow-only: the tab bar's four primary seats are taken (creators.md Phase C14).
    visible: () => can.viewClassResources("LEARNER", true),
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
