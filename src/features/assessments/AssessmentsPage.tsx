import { useSearchParams } from "react-router";
import { useAuthStore } from "@/stores/authStore";
import { AdminResultsPanel } from "@/features/assessments/components/AdminResultsPanel";
import { TeacherEntryPanel } from "@/features/assessments/components/TeacherEntryPanel";

/**
 * Assessments, split by role like SubjectsPage/StudentsPage: a TEACHER
 * records scores/ratings for their own classes; SCHOOL_ADMIN/BRANCH_ADMIN
 * see the read-only broadsheet and the publish control - see CLAUDE.md's
 * Roles matrix (recording is TEACHER-only, admins have no correction path).
 * An optional `?classId=` (from ClassDetailPage's "Results & broadsheet"
 * quick link) seeds the initial class selection.
 */
export function AssessmentsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get("classId") ?? undefined;
  if (role === "TEACHER") {
    return <TeacherEntryPanel initialClassId={initialClassId} />;
  }
  return <AdminResultsPanel initialClassId={initialClassId} />;
}
