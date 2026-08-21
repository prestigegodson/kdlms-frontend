import { AdminLessonNotePanel } from "@/features/lessonNotes/components/AdminLessonNotePanel";
import { TeacherLessonNotePanel } from "@/features/lessonNotes/components/TeacherLessonNotePanel";
import { useAuthStore } from "@/stores/authStore";

/** Role fork: SCHOOL_ADMIN/BRANCH_ADMIN browse the school-wide catalogue; TEACHER gets their own assigned subjects only (TimetablePage/MessagesPage's shape). */
export function LessonNotesPage() {
  const role = useAuthStore((state) => state.user?.role);

  if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
    return <AdminLessonNotePanel />;
  }

  return <TeacherLessonNotePanel />;
}
