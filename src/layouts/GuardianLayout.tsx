import { Bell, ClipboardCheck, ClipboardList, MessageSquare, Users } from "lucide-react";
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
  // re-render, so the Messages `visible()`/`badge()` closures above
  // re-evaluate once these async fetches resolve - mirrors SchoolLayout.
  useFeatureStore((state) => state.communication);
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
