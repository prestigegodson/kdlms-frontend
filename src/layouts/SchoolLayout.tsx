import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Contact,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  BookOpen,
  Scale,
  School,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useAcademicContextStore } from "@/stores/academicContextStore";
import { useAuthStore } from "@/stores/authStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/school", icon: LayoutDashboard },
  {
    label: "Sessions & Terms",
    href: "/school/academics/sessions",
    icon: CalendarDays,
    group: "Academics",
    // Calendar setup - a TEACHER only ever needs read access to the
    // current session/term (the topbar's context chip), not this screen.
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "Levels",
    href: "/school/academics/levels",
    icon: Layers,
    group: "Academics",
    // School-wide, not branch-scoped - see auth/permissions.ts's manageLevels.
    roles: ["SCHOOL_ADMIN"],
  },
  { label: "Subjects", href: "/school/academics/subjects", icon: BookOpen, group: "Academics" },
  { label: "Classes", href: "/school/academics/classes", icon: Library, group: "Academics" },
  {
    label: "Grading systems",
    href: "/school/assessments/grading",
    icon: Scale,
    group: "Academics",
    // School-wide, not branch-scoped - see auth/permissions.ts's manageGradingSystems.
    roles: ["SCHOOL_ADMIN"],
  },
  { label: "Assessments", href: "/school/assessments", icon: ClipboardCheck, group: "Academics" },
  {
    label: "Attendance",
    href: "/school/attendance",
    icon: ClipboardList,
    group: "Academics",
    // Both admin roles always see it (read-only for them); a TEACHER only
    // when they class-teach at least one class - see auth/permissions.ts.
    visible: () => {
      const role = useAuthStore.getState().user?.role;
      if (role !== "TEACHER") {
        return true;
      }
      return useTeacherScopeStore.getState().capabilities?.isClassTeacher ?? false;
    },
  },
  { label: "Teachers", href: "/school/academics/teachers", icon: Users, group: "People", roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"] },
  { label: "Students", href: "/school/students", icon: GraduationCap, group: "People" },
  { label: "Guardians", href: "/school/guardians", icon: Contact, group: "People", roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"] },
  { label: "Branches", href: "/school/branches", icon: Building2, group: "Administration", roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"] },
  { label: "School Profile", href: "/school/profile", icon: School, group: "Administration", roles: ["SCHOOL_ADMIN"] },
  { label: "Subscription", href: "/school/subscription", icon: CreditCard, group: "Administration", roles: ["SCHOOL_ADMIN"] },
];

export function SchoolLayout() {
  const role = useAuthStore((state) => state.user?.role);
  const fetchTeacherScope = useTeacherScopeStore((state) => state.fetchIfNeeded);
  // Subscribed only to force a re-render (and so PortalShell's Attendance
  // `visible()` check re-evaluates, and the context chip below picks up the
  // teacher's current term) once the async fetch below resolves - the
  // capabilities themselves are read fresh from getState() where needed.
  const teacherCapabilities = useTeacherScopeStore((state) => state.capabilities);

  const fetchAcademicContext = useAcademicContextStore((state) => state.fetchIfNeeded);
  const adminContextLabel = useAcademicContextStore((state) => state.label);

  useEffect(() => {
    if (role === "TEACHER") {
      fetchTeacherScope();
    } else if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
      fetchAcademicContext();
    }
  }, [role, fetchTeacherScope, fetchAcademicContext]);

  const contextLabel =
    role === "TEACHER"
      ? (teacherCapabilities?.currentTermName ??
        (teacherCapabilities?.currentTermNumber ? `Term ${teacherCapabilities.currentTermNumber}` : null))
      : adminContextLabel;

  return (
    <PortalShell
      portalName="School"
      navItems={NAV_ITEMS}
      contextLabel={contextLabel ?? undefined}
      banner={<SubscriptionBanner />}
    />
  );
}
