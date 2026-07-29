import { PortalShell } from "@/layouts/PortalShell";

const NAV_ITEMS = [
  { label: "Schools", href: "/admin/schools" },
  { label: "Packages", href: "/admin/packages" },
  { label: "Result Templates", href: "/admin/templates" },
];

export function SystemAdminLayout() {
  return <PortalShell portalName="System Admin" navItems={NAV_ITEMS} />;
}
