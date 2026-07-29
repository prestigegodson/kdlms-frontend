import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/school" },
  { label: "Branches", href: "/school/branches", roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"] },
  { label: "School Profile", href: "/school/profile", roles: ["SCHOOL_ADMIN"] },
  { label: "Subscription", href: "/school/subscription", roles: ["SCHOOL_ADMIN"] },
  { label: "Sessions & Terms", href: "/school/academics/sessions" },
  { label: "Subjects", href: "/school/academics/subjects" },
  { label: "Classes", href: "/school/academics/classes" },
  { label: "Teachers", href: "/school/academics/teachers", roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"] },
  { label: "Students", href: "/school/students" },
  { label: "Assessments", href: "/school/assessments" },
  { label: "Attendance", href: "/school/attendance" },
];

export function SchoolLayout() {
  return <PortalShell portalName="School" navItems={NAV_ITEMS} banner={<SubscriptionBanner />} />;
}
