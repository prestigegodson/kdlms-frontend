import { Bell, CalendarDays, ClipboardCheck, ClipboardList, MessageSquare, NotebookPen, Users } from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useFeatureStore } from "@/stores/featureStore";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";

const NAV_ITEMS: NavItem[] = [
  { label: "My Wards", href: "/guardian", icon: Users, primary: ["GUARDIAN"] },
  { label: "Results", href: "/guardian/results", icon: ClipboardCheck, primary: ["GUARDIAN"] },
  { label: "Attendance", href: "/guardian/attendance", icon: ClipboardList, primary: ["GUARDIAN"] },
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
    label: "Timetable",
    href: "/guardian/timetable",
    icon: CalendarDays,
    // Overflow-only (drawer via the tab bar's More tab) - My Wards/Results/
    // Attendance/Messages already fill the tab bar's four-destination limit
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
  useUnreadMessagesStore((state) => state.count);

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

  return <PortalShell portalName="Guardian" navItems={NAV_ITEMS} />;
}
