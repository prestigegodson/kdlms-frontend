import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Contact,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Library,
  BookOpen,
  MessageSquare,
  Scale,
  School,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useAcademicContextStore } from "@/stores/academicContextStore";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { useSchoolBrandingStore } from "@/stores/schoolBrandingStore";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";

// Tab-bar order below `lg` follows this array, capped at 4 per role
// (NavItem.primary): both admin roles get Dashboard, Assessments, Messages,
// Students; TEACHER gets Dashboard, Assessments, Attendance, Messages.
// Attendance is deliberately not an admin primary - it's read-only for
// admins (CLAUDE.md's class-teacher-write rule), so it isn't one of their
// everyday destinations.
const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/school",
    icon: LayoutDashboard,
    primary: ["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER"],
  },
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
  {
    label: "Period grid",
    href: "/school/timetable/periods",
    icon: Clock,
    group: "Academics",
    // School-wide, not branch-scoped, like Levels/Grading systems - plus the
    // school's Timetables package entitlement, the same hard-lockout shape
    // Messages uses. SCHOOL_ADMIN can edit (and copy from another level),
    // BRANCH_ADMIN sees it read-only - see auth/permissions.ts's
    // viewPeriodGrid/managePeriodGrid.
    visible: () => {
      const role = useAuthStore.getState().user?.role;
      const entitled = useFeatureStore.getState().timetable;
      return can.viewPeriodGrid(role, entitled);
    },
  },
  {
    label: "Timetable",
    href: "/school/timetable",
    icon: Clock,
    group: "Academics",
    // Admin (authoring) and every TEACHER (their own "My timetable"/"Class
    // timetable" tabs, TimetablePage's role fork) - see auth/permissions.ts's
    // viewTimetable, the single source of truth. `manageTimetable` narrows
    // further to who may actually write a class's grid.
    visible: () => {
      const role = useAuthStore.getState().user?.role;
      const isClassTeacher = useTeacherScopeStore.getState().capabilities?.isClassTeacher ?? false;
      const entitled = useFeatureStore.getState().timetable;
      return can.viewTimetable(role, { isClassTeacher }, entitled);
    },
  },
  {
    label: "Assessments",
    href: "/school/assessments",
    icon: ClipboardCheck,
    group: "Academics",
    primary: ["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER"],
  },
  {
    label: "Attendance",
    href: "/school/attendance",
    icon: ClipboardList,
    group: "Academics",
    // TEACHER-primary only - see the file-level comment above.
    primary: ["TEACHER"],
    // Both admin roles always see it (read-only for them); a TEACHER only
    // when they class-teach at least one class - see auth/permissions.ts's
    // viewAttendance, the single source of truth nav/route/in-page controls
    // all read from.
    visible: () => {
      const role = useAuthStore.getState().user?.role;
      const isClassTeacher = useTeacherScopeStore.getState().capabilities?.isClassTeacher ?? false;
      return can.viewAttendance(role, { isClassTeacher });
    },
  },
  {
    label: "Reports",
    href: "/school/reports",
    icon: FileText,
    group: "Academics",
    // Same visibility as Assessments/broadsheets - admins (branch-scoped for
    // BRANCH_ADMIN), a teacher's own classes - see auth/permissions.ts's viewReports.
  },
  {
    label: "Messages",
    href: "/school/messages",
    icon: MessageSquare,
    group: "Academics",
    primary: ["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER"],
    // Gated on the school's communication entitlement on top of role/scope -
    // see auth/permissions.ts's viewMessages, the single source of truth.
    visible: () => {
      const role = useAuthStore.getState().user?.role;
      const isClassTeacher = useTeacherScopeStore.getState().capabilities?.isClassTeacher ?? false;
      const entitled = useFeatureStore.getState().communication;
      return can.viewMessages(role, { isClassTeacher }, entitled);
    },
    badge: () => useUnreadMessagesStore.getState().count,
  },
  {
    label: "Administrators",
    href: "/school/administrators",
    icon: ShieldCheck,
    group: "People",
    // Not BRANCH_ADMIN-visible - see auth/permissions.ts's manageBranchAdmins.
    roles: ["SCHOOL_ADMIN"],
  },
  {
    label: "Teachers",
    href: "/school/academics/teachers",
    icon: Users,
    group: "People",
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "Students",
    href: "/school/students",
    icon: GraduationCap,
    group: "People",
    primary: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "Guardians",
    href: "/school/guardians",
    icon: Contact,
    group: "People",
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "Branches",
    href: "/school/branches",
    icon: Building2,
    group: "Administration",
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "School Profile",
    href: "/school/profile",
    icon: School,
    group: "Administration",
    roles: ["SCHOOL_ADMIN"],
  },
  {
    label: "School Settings",
    href: "/school/settings",
    icon: Settings,
    group: "Administration",
    // SCHOOL_ADMIN only, like School Profile - see auth/permissions.ts's manageSchoolSettings.
    roles: ["SCHOOL_ADMIN"],
  },
  {
    label: "Report Settings",
    href: "/school/reports/settings",
    icon: FileText,
    group: "Administration",
    // SCHOOL_ADMIN edits branding/level templates; BRANCH_ADMIN sees the
    // same screen read-only - see auth/permissions.ts's viewReportSettings.
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
  {
    label: "Subscription",
    href: "/school/subscription",
    icon: CreditCard,
    group: "Administration",
    roles: ["SCHOOL_ADMIN"],
  },
  {
    label: "Support",
    href: "/school/support",
    icon: LifeBuoy,
    group: "Administration",
    // Read-only for both - see auth/permissions.ts's viewSupportContact.
    roles: ["SCHOOL_ADMIN", "BRANCH_ADMIN"],
  },
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

  // Readable by every role this layout admits (SCHOOL_ADMIN, BRANCH_ADMIN,
  // TEACHER - see SchoolSettingsController), unlike the role-gated fetches
  // below - a TEACHER needs allowWeekendAttendance to shape the attendance
  // date picker just as much as the admin roles need it for School Settings.
  const fetchSchoolSettings = useSchoolSettingsStore((state) => state.fetchIfNeeded);

  // Every role this layout admits needs the entitlement flags for the
  // Messages/Period grid nav items' visible() checks above.
  const fetchFeatures = useFeatureStore((state) => state.fetchIfNeeded);
  // Readable by every role this layout admits, same as school settings above -
  // PortalShell's sidebar reads this to swap the wordmark for the school's logo.
  const fetchSchoolBranding = useSchoolBrandingStore((state) => state.fetchIfNeeded);
  const fetchUnreadMessages = useUnreadMessagesStore((state) => state.fetchIfNeeded);
  // Subscribed (return value intentionally discarded) only to force a
  // re-render - so the Messages/Period grid `visible()`/`badge()` closures
  // above re-evaluate once these async fetches resolve, the same reason
  // teacherCapabilities is subscribed below. The values themselves are read
  // fresh from getState() inside those closures.
  useFeatureStore((state) => state.communication);
  useFeatureStore((state) => state.timetable);
  useUnreadMessagesStore((state) => state.count);

  useEffect(() => {
    if (role === "TEACHER") {
      fetchTeacherScope();
      fetchUnreadMessages("TEACHER");
    } else if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
      fetchAcademicContext();
    }
    fetchSchoolSettings();
    fetchFeatures();
    fetchSchoolBranding();
  }, [
    role,
    fetchTeacherScope,
    fetchAcademicContext,
    fetchSchoolSettings,
    fetchFeatures,
    fetchSchoolBranding,
    fetchUnreadMessages,
  ]);

  const contextLabel =
    role === "TEACHER"
      ? (teacherCapabilities?.currentTermName ??
        (teacherCapabilities?.currentTermNumber
          ? `Term ${teacherCapabilities.currentTermNumber}`
          : null))
      : adminContextLabel;

  return (
    <PortalShell
      portalName="School"
      navItems={NAV_ITEMS}
      contextLabel={contextLabel ?? undefined}
      banner={<SubscriptionBanner />}
      // Academics holds the everyday teaching/records screens (classes,
      // assessments, attendance, messages); People and Administration are
      // setup surfaces visited far less often, so they start collapsed -
      // see PortalShell's collapsible sidebar groups.
      defaultOpenGroups={["Academics"]}
    />
  );
}
