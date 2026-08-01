import { AdminAttendancePanel } from "@/features/attendance/components/AdminAttendancePanel";
import { TeacherRegisterPanel } from "@/features/attendance/components/TeacherRegisterPanel";
import { useAuthStore } from "@/stores/authStore";

/** Role fork: TEACHER marks their own classes; SCHOOL_ADMIN/BRANCH_ADMIN get the read-only views. */
export function AttendancePage() {
  const role = useAuthStore((state) => state.user?.role);
  if (role === "TEACHER") {
    return <TeacherRegisterPanel />;
  }
  return <AdminAttendancePanel />;
}
