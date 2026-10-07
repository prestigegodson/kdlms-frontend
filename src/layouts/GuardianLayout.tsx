import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Presentation,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useFeatureStore } from "@/stores/featureStore";
import { useClassMessagesUnreadStore } from "@/stores/classMessagesUnreadStore";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";

const NAV_ITEMS: NavItem[] = [
  { label: "My Wards", href: "/guardian", icon: Users, primary: ["GUARDIAN"] },
  { label: "Results", href: "/guardian/results", icon: ClipboardCheck, primary: ["GUARDIAN"] },
  {
    label: "Bills",
    href: "/guardian/bills",
    icon: Receipt,
    primary: ["GUARDIAN"],
    // Per-term bills and balances (Phase 45G's Fees page, with payments split out to their own
    // page below) - in the tab bar in Attendance's place. Gated on the school's Billing
    // entitlement, the same full-lockout shape Messages uses - see auth/permissions.ts's
    // viewWardFees.
    visible: () => can.viewWardFees("GUARDIAN", useFeatureStore.getState().billing),
  },
  {
    label: "Attendance",
    href: "/guardian/attendance",
    icon: ClipboardList,
    // A seat-filler, not a primary: Bills took its tab, but when Bills or Messages is hidden (the
    // school isn't entitled to Billing/Communication) it slots back into the free seat - see
    // NavItem.primaryFallback.
    primaryFallback: ["GUARDIAN"],
  },
  {
    label: "Messages",
    href: "/guardian/messages",
    icon: MessageSquare,
    primary: ["GUARDIAN"],
    // Gated on the school's communication entitlement - see auth/permissions.ts's
    // viewMessages, the single source of truth nav/route/in-page controls read from.
    visible: () => can.viewMessages("GUARDIAN", null, useFeatureStore.getState().communication),
    badge: () => useUnreadMessagesStore.getState().count,
  },
  {
    label: "Payments",
    href: "/guardian/payments",
    icon: Wallet,
    // Overflow-only (drawer via the tab bar's More tab) - every payment across all wards, in one
    // table. Same Billing gate as Bills above.
    visible: () => can.viewWardFees("GUARDIAN", useFeatureStore.getState().billing),
  },
  {
    label: "Timetable",
    href: "/guardian/timetable",
    icon: CalendarDays,
    // Overflow-only (drawer via the tab bar's More tab) - My Wards/Results/
    // Bills/Messages already fill the tab bar's four-destination limit
    // (CLAUDE.md's mobile nav rule). Gated on the school's Timetables
    // package entitlement, the same full-lockout shape `viewMessages` uses -
    // see auth/permissions.ts's viewTimetable.
    visible: () => can.viewTimetable("GUARDIAN", null, useFeatureStore.getState().timetable),
  },
  {
    label: "Lesson notes",
    href: "/guardian/lesson-notes",
    icon: NotebookPen,
    // Overflow-only (drawer via the tab bar's More tab) - see the Timetable
    // item's comment above for why. A separate `viewWardLessonNotes` check,
    // not `viewLessonNotes` (which is staff-only) - see auth/permissions.ts.
    visible: () => can.viewWardLessonNotes("GUARDIAN", useFeatureStore.getState().lessonNotes),
  },
  {
    label: "CBT/Quizzes",
    href: "/guardian/take-home-quizzes",
    icon: FileCheck2,
    // Overflow-only (drawer via the tab bar's More tab) - see the Timetable item's comment above
    // for why. Gated on the school's take-home-quiz entitlement, the same full-lockout shape
    // viewTimetable/viewWardLessonNotes use - see auth/permissions.ts's viewWardTakeHomeQuizzes.
    visible: () => can.viewWardTakeHomeQuizzes("GUARDIAN", useFeatureStore.getState().takeHomeQuiz),
  },
  {
    label: "Online classes",
    href: "/guardian/online-classes",
    icon: Presentation,
    // Overflow-only - see the Timetable item's comment above. Shown only to a guardian who follows a
    // learner in an education creator's classes (creators.md Phase C5) - see auth/permissions.ts's
    // viewOnlineClasses.
    visible: () => can.viewOnlineClasses("GUARDIAN", useFeatureStore.getState().onlineClasses),
  },
  {
    label: "Class messages",
    href: "/guardian/class-messages",
    icon: MessagesSquare,
    // Overflow-only, beside Online classes - conversations with the tutors of the creator learners
    // this guardian follows (creators.md Phase C11), separate from the school Messages above.
    visible: () => can.viewClassMessages("GUARDIAN", useFeatureStore.getState().onlineClasses),
    badge: () => useClassMessagesUnreadStore.getState().count,
  },
  {
    label: "Class lesson notes",
    href: "/guardian/class-lesson-notes",
    icon: NotebookPen,
    // Overflow-only, beside Class messages - the published lesson notes of the creator classes this
    // guardian's learners take (creators.md Phase C12). Each tutor's plan is checked by the server.
    visible: () => can.viewClassLessonNotes("GUARDIAN", useFeatureStore.getState().onlineClasses),
  },
  {
    label: "Class quizzes",
    href: "/guardian/class-quizzes",
    icon: ClipboardCheck,
    // Overflow-only, beside Class lesson notes - released results of the creator classes' quizzes this
    // guardian's learners take (creators.md Phase C13), separate from the school Take-home quizzes.
    visible: () => can.viewClassQuizzes("GUARDIAN", useFeatureStore.getState().onlineClasses),
  },
  {
    label: "Class resources",
    href: "/guardian/class-resources",
    icon: BookOpen,
    // Overflow-only, beside Class quizzes - the learning resources of the creator classes this
    // guardian's learners take (creators.md Phase C14), read-only. Each tutor's plan is checked by the server.
    visible: () => can.viewClassResources("GUARDIAN", useFeatureStore.getState().onlineClasses),
  },
  {
    label: "Notifications",
    href: "/guardian/settings",
    icon: Bell,
    // Overflow-only (drawer via the tab bar's More tab), not primary - the
    // four tabs above are the guardian's everyday destinations.
    // Only relevant while the school's communication entitlement is on - see
    // auth/permissions.ts's manageMyNotifications.
    visible: () => can.manageMyNotifications("GUARDIAN", useFeatureStore.getState().communication),
  },
];

export function GuardianLayout() {
  const fetchFeatures = useFeatureStore((state) => state.fetchIfNeeded);
  const fetchUnreadMessages = useUnreadMessagesStore((state) => state.fetchIfNeeded);
  // Subscribed (return value intentionally discarded) only to force a
  // re-render, so the Messages/Timetable `visible()`/`badge()` closures above
  // re-evaluate once these async fetches resolve - mirrors SchoolLayout.
  useFeatureStore((state) => state.communication);
  useFeatureStore((state) => state.timetable);
  useFeatureStore((state) => state.lessonNotes);
  useFeatureStore((state) => state.takeHomeQuiz);
  useFeatureStore((state) => state.billing);
  useUnreadMessagesStore((state) => state.count);
  const onlineClasses = useFeatureStore((state) => state.onlineClasses);
  const fetchClassUnread = useClassMessagesUnreadStore((state) => state.fetchIfNeeded);
  useClassMessagesUnreadStore((state) => state.count);

  // Deliberately no schoolBrandingStore fetch here, unlike SchoolLayout: a
  // guardian's token carries no schoolId (CLAUDE.md's cross-school guardian
  // rule - one login may hold wards at several schools), the backend returns
  // an empty SchoolBrandingView for a GUARDIAN caller, and PortalShell already
  // falls back to the platform wordmark when the store has no logo - so the
  // fetch would be a wasted round-trip that leaves the store empty anyway.
  useEffect(() => {
    fetchFeatures();
    fetchUnreadMessages("GUARDIAN");
  }, [fetchFeatures, fetchUnreadMessages]);

  // Only a guardian who follows a creator's learner has class messages to count.
  useEffect(() => {
    if (onlineClasses) {
      fetchClassUnread("GUARDIAN");
    }
  }, [onlineClasses, fetchClassUnread]);

  return <PortalShell portalName="Guardian" navItems={NAV_ITEMS} />;
}
