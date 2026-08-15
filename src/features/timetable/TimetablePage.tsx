import { useSearchParams } from "react-router";
import { AdminTimetablePanel } from "@/features/timetable/components/AdminTimetablePanel";
import { TeacherTimetablePanel } from "@/features/timetable/components/TeacherTimetablePanel";
import { useAuthStore } from "@/stores/authStore";

/**
 * Role fork: SCHOOL_ADMIN/BRANCH_ADMIN get the class-timetable authoring
 * screen; TEACHER gets the "My timetable" / "Class timetable" tabs
 * (AttendancePage.tsx is the reference shape). An optional `?classId=`
 * seeds the admin panel's initial class selection.
 */
export function TimetablePage() {
  const role = useAuthStore((state) => state.user?.role);
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get("classId") ?? undefined;

  if (role === "SCHOOL_ADMIN" || role === "BRANCH_ADMIN") {
    return <AdminTimetablePanel initialClassId={initialClassId} />;
  }

  return <TeacherTimetablePanel />;
}
