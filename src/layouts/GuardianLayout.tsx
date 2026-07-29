import { PortalShell } from "@/layouts/PortalShell";

const NAV_ITEMS = [
  { label: "My Wards", href: "/guardian" },
  { label: "Results", href: "/guardian/results" },
  { label: "Attendance", href: "/guardian/attendance" },
];

export function GuardianLayout() {
  return <PortalShell portalName="Guardian" navItems={NAV_ITEMS} />;
}
