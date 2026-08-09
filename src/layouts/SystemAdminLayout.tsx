import { Building2, FileText, LayoutDashboard, Package } from "lucide-react";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";

// All four of this portal's items are tab-bar primary, so MobileTabBar never
// shows a "More" tab here - there's nothing left over to put in it.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, primary: ["SYSTEM_ADMIN"] },
  { label: "Schools", href: "/admin/schools", icon: Building2, primary: ["SYSTEM_ADMIN"] },
  { label: "Packages", href: "/admin/packages", icon: Package, primary: ["SYSTEM_ADMIN"] },
  { label: "Result Templates", href: "/admin/templates", icon: FileText, primary: ["SYSTEM_ADMIN"] },
];

export function SystemAdminLayout() {
  return <PortalShell portalName="System Admin" navItems={NAV_ITEMS} />;
}
