import { AdminMessageOverview } from "@/features/communication/components/AdminMessageOverview";
import { TeacherMessageBoard } from "@/features/communication/components/TeacherMessageBoard";
import { LevelHeadViewSwitch } from "@/features/levelHeads/LevelHeadViewSwitch";
import { useIsLevelHead } from "@/features/levelHeads/useLevelHead";
import { useAuthStore } from "@/stores/authStore";

/**
 * Role fork: TEACHER logs and reads their own classes; SCHOOL_ADMIN/BRANCH_ADMIN get the read-only
 * overview; a Head of Level gets both, as a tab pair.
 */
export function MessagesPage() {
  const role = useAuthStore((state) => state.user?.role);
  const levelHead = useIsLevelHead();
  if (levelHead) {
    return (
      <LevelHeadViewSwitch
        ariaLabel="Message views"
        teachingView={<TeacherMessageBoard />}
        levelsView={<AdminMessageOverview />}
      />
    );
  }
  if (role === "TEACHER") {
    return <TeacherMessageBoard />;
  }
  return <AdminMessageOverview />;
}
