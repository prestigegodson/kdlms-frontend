import { AdminMessageOverview } from "@/features/communication/components/AdminMessageOverview";
import { TeacherMessageBoard } from "@/features/communication/components/TeacherMessageBoard";
import { useAuthStore } from "@/stores/authStore";

/** Role fork: TEACHER logs and reads their own classes; SCHOOL_ADMIN/BRANCH_ADMIN get the read-only overview. */
export function MessagesPage() {
  const role = useAuthStore((state) => state.user?.role);
  if (role === "TEACHER") {
    return <TeacherMessageBoard />;
  }
  return <AdminMessageOverview />;
}
