import { ClipboardCheck, ClipboardList, Users } from "lucide-react";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";

const NAV_ITEMS: NavItem[] = [
  { label: "My Wards", href: "/guardian", icon: Users },
  { label: "Results", href: "/guardian/results", icon: ClipboardCheck },
  { label: "Attendance", href: "/guardian/attendance", icon: ClipboardList },
];

export function GuardianLayout() {
  return <PortalShell portalName="Guardian" navItems={NAV_ITEMS} />;
}
