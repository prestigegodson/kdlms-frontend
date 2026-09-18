import { BookOpen, CalendarDays, ClipboardCheck, Home, ListChecks } from "lucide-react";
import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { type NavItem, PortalShell } from "@/layouts/PortalShell";
import { useFeatureStore } from "@/stores/featureStore";
import { useSchoolBrandingStore } from "@/stores/schoolBrandingStore";
import { useStudentStore } from "@/stores/studentStore";

/**
 * Four primary destinations, exactly `style_guide.md`'s four-destination cap. Quizzes (Phase
 * 35I.3) is now primary; Timetable moved into the More drawer to make room - the `GuardianLayout`
 * pattern of a module's own screen arriving in the drawer before/after it holds a primary slot.
 */
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/student", icon: Home, primary: ["STUDENT"] },
  {
    label: "Resources",
    href: "/student/resources",
    icon: BookOpen,
    primary: ["STUDENT"],
    // Gated on the school's On-demand learning package entitlement - see auth/permissions.ts's
    // viewStudentResources.
    visible: () => can.viewStudentResources("STUDENT", useFeatureStore.getState().onDemandLearning),
  },
  {
    label: "Quizzes",
    href: "/student/quizzes",
    icon: ListChecks,
    primary: ["STUDENT"],
    // Gated on the school's Take-home quizzes entitlement - see auth/permissions.ts's viewStudentQuizzes.
    visible: () => can.viewStudentQuizzes("STUDENT", useFeatureStore.getState().takeHomeQuiz),
  },
  { label: "Results", href: "/student/results", icon: ClipboardCheck, primary: ["STUDENT"] },
  {
    label: "Timetable",
    href: "/student/timetable",
    icon: CalendarDays,
    // Gated on the school's Timetables package entitlement, the same full-lockout shape
    // GuardianLayout's own Timetable item uses - see auth/permissions.ts's viewStudentTimetable.
    visible: () => can.viewStudentTimetable("STUDENT", useFeatureStore.getState().timetable),
  },
];

export function StudentLayout() {
  const fetchStudent = useStudentStore((state) => state.fetchIfNeeded);
  const fetchFeatures = useFeatureStore((state) => state.fetchIfNeeded);
  // Unlike GuardianLayout, a STUDENT's token carries a real schoolId (CLAUDE.md's Domain Rules),
  // so - like SchoolLayout - this portal does fetch the school's own brand mark rather than
  // falling back to the platform wordmark.
  const fetchSchoolBranding = useSchoolBrandingStore((state) => state.fetchIfNeeded);
  // Subscribed (return value intentionally discarded) only to force a re-render, so the
  // Resources/Quizzes/Timetable items' visible() closures above re-evaluate once the fetch
  // resolves - mirrors GuardianLayout/SchoolLayout.
  useFeatureStore((state) => state.onDemandLearning);
  useFeatureStore((state) => state.takeHomeQuiz);
  useFeatureStore((state) => state.timetable);

  useEffect(() => {
    fetchStudent();
    fetchFeatures();
    fetchSchoolBranding();
  }, [fetchStudent, fetchFeatures, fetchSchoolBranding]);

  return <PortalShell portalName="Student" navItems={NAV_ITEMS} />;
}
