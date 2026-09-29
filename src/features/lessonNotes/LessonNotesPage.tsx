import { useSearchParams } from "react-router";
import { AdminLessonNotePanel } from "@/features/lessonNotes/components/AdminLessonNotePanel";
import { TeacherLessonNotePanel } from "@/features/lessonNotes/components/TeacherLessonNotePanel";
import { LevelHeadViewSwitch } from "@/features/levelHeads/LevelHeadViewSwitch";
import { useIsLevelHead } from "@/features/levelHeads/useLevelHead";
import { useAuthStore } from "@/stores/authStore";

/**
 * Role fork: SCHOOL_ADMIN/BRANCH_ADMIN browse the school-wide catalogue; TEACHER gets their own
 * assigned subjects only (TimetablePage/MessagesPage's shape). An optional `?subjectId=` (from
 * SubjectsPage's "Lesson notes" row action) seeds the TEACHER panel's initial subject selection -
 * the admin panel sources subjects from the school-wide catalogue, so it doesn't take this seed.
 * A Head of Level is both, so they get the two as a tab pair.
 */
export function LessonNotesPage() {
  const role = useAuthStore((state) => state.user?.role);
  const levelHead = useIsLevelHead();
  const [searchParams] = useSearchParams();

  if (levelHead) {
    return (
      <LevelHeadViewSwitch
        ariaLabel="Lesson note views"
        teachingView={<TeacherLessonNotePanel initialSubjectId={searchParams.get("subjectId") ?? undefined} />}
        levelsView={<AdminLessonNotePanel />}
      />
    );
  }
  if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
    return <AdminLessonNotePanel />;
  }

  return <TeacherLessonNotePanel initialSubjectId={searchParams.get("subjectId") ?? undefined} />;
}
