import {
  Bot,
  Building2,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Package,
  Ticket,
} from "lucide-react";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";

// Only the first four are tab-bar primary (MobileTabBar caps at 4), so
// Creators, Payments, Coupons, Support Contact and AI live in the drawer behind "More" below `lg`.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, primary: ["SYSTEM_ADMIN"] },
  { label: "Schools", href: "/admin/schools", icon: Building2, primary: ["SYSTEM_ADMIN"] },
  { label: "Packages", href: "/admin/packages", icon: Package, primary: ["SYSTEM_ADMIN"] },
  { label: "Result Templates", href: "/admin/templates", icon: FileText, primary: ["SYSTEM_ADMIN"] },
  { label: "Creators", href: "/admin/creators", icon: GraduationCap },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "Support Contact", href: "/admin/support", icon: LifeBuoy },
  { label: "AI", href: "/admin/ai", icon: Bot },
];

export function SystemAdminLayout() {
  return <PortalShell portalName="System Admin" navItems={NAV_ITEMS} />;
}
