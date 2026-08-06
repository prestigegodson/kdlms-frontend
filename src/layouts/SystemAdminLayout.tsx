import { Building2, FileText, LayoutDashboard, Package } from "lucide-react";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Schools", href: "/admin/schools", icon: Building2 },
  { label: "Packages", href: "/admin/packages", icon: Package },
  { label: "Result Templates", href: "/admin/templates", icon: FileText },
];

export function SystemAdminLayout() {
  return <PortalShell portalName="System Admin" navItems={NAV_ITEMS} />;
}
