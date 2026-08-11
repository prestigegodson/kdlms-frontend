import { useSearchParams } from "react-router";
import { AdminAttendancePanel } from "@/features/attendance/components/AdminAttendancePanel";
import { TeacherRegisterPanel } from "@/features/attendance/components/TeacherRegisterPanel";
import { useAuthStore } from "@/stores/authStore";

/**
 * Role fork: TEACHER marks their own classes; SCHOOL_ADMIN/BRANCH_ADMIN get
 * the read-only views. An optional `?classId=` (from ClassDetailPage's
 * "Attendance register" quick link) seeds the initial class selection -
 * used only as each panel's `useState` initializer, so the existing
 * "default to the first class" fallback still applies with no param.
 */
export function AttendancePage() {
  const role = useAuthStore((state) => state.user?.role);
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get("classId") ?? undefined;
  if (role === "TEACHER") {
    return <TeacherRegisterPanel initialClassId={initialClassId} />;
  }
  return <AdminAttendancePanel initialClassId={initialClassId} />;
}
