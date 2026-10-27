import {
  Bot,
  Building2,
  CreditCard,
  FileText,
  GraduationCap,
  HardDrive,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Package,
  Ticket,
} from "lucide-react";
import { useEffect } from "react";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useContactEnquiriesUnreadStore } from "@/stores/contactEnquiriesUnreadStore";

// Only the first four are tab-bar primary (MobileTabBar caps at 4), so
// Creators, Enquiries, Newsletters, Payments, Coupons, Support Contact, AI and Storage live in the drawer behind "More" below `lg`.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, primary: ["SYSTEM_ADMIN"] },
  { label: "Schools", href: "/admin/schools", icon: Building2, primary: ["SYSTEM_ADMIN"] },
  { label: "Packages", href: "/admin/packages", icon: Package, primary: ["SYSTEM_ADMIN"] },
  { label: "Result Templates", href: "/admin/templates", icon: FileText, primary: ["SYSTEM_ADMIN"] },
  { label: "Tutors", href: "/admin/tutors", icon: GraduationCap },
  {
    label: "Enquiries",
    href: "/admin/enquiries",
    icon: Inbox,
    // "Contact us" enquiries from the public website that nobody has opened yet.
    badge: () => useContactEnquiriesUnreadStore.getState().count,
  },
  { label: "Newsletters", href: "/admin/newsletters", icon: Mail },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Coupons", href: "/admin/coupons", icon: Ticket },
  { label: "Support Contact", href: "/admin/support", icon: LifeBuoy },
  { label: "AI", href: "/admin/ai", icon: Bot },
  { label: "Storage", href: "/admin/storage", icon: HardDrive },
];

export function SystemAdminLayout() {
  const fetchUnreadEnquiries = useContactEnquiriesUnreadStore((state) => state.fetchIfNeeded);
  // Subscribed only to re-render once the fetch resolves, so the Enquiries badge() re-evaluates.
  useContactEnquiriesUnreadStore((state) => state.count);

  useEffect(() => {
    void fetchUnreadEnquiries();
  }, [fetchUnreadEnquiries]);

  return <PortalShell portalName="System Admin" navItems={NAV_ITEMS} />;
}
