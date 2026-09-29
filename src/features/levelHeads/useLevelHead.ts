import { useMemo } from "react";
import type { LevelView } from "@/api/levels";
import { isLevelHead } from "@/auth/permissions";
import { useAuthStore } from "@/stores/authStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";

/**
 * Whether the signed-in TEACHER heads at least one level (Head of Level) - see
 * auth/permissions.ts's `isLevelHead`. False until SchoolLayout's capabilities
 * fetch has landed.
 */
export function useIsLevelHead(): boolean {
  const role = useAuthStore((state) => state.user?.role);
  const capabilities = useTeacherScopeStore((state) => state.capabilities);
  return isLevelHead(role, capabilities);
}

/**
 * `levels` narrowed to the ones a Head of Level heads, for the level pickers on
 * admin-shaped screens - every other caller gets `levels` back unchanged. The
 * server enforces the same narrowing regardless; this only keeps the UI from
 * offering a level that would come back empty or refused.
 */
export function useHeadedLevels(levels: LevelView[]): LevelView[] {
  const role = useAuthStore((state) => state.user?.role);
  const capabilities = useTeacherScopeStore((state) => state.capabilities);
  return useMemo(() => {
    if (!isLevelHead(role, capabilities)) {
      return levels;
    }
    const headed = new Set(capabilities?.headOfLevelIds ?? []);
    return levels.filter((level) => headed.has(level.id));
  }, [role, capabilities, levels]);
}
