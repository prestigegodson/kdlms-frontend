import { useEffect } from "react";
import { can } from "@/auth/permissions";
import { useBranchStore } from "@/stores/branchStore";
import { useAuthStore } from "@/stores/authStore";

export interface BranchScope {
  /**
   * False only while a SCHOOL_ADMIN's branch list hasn't resolved yet - a
   * caller should hold off fetching branch-filtered data until this flips
   * true, so it never fires one unscoped request before the auto-selected
   * branch is known. Always true for a BRANCH_ADMIN/TEACHER, whose branch
   * comes from their token instead.
   */
  ready: boolean;
  /**
   * `undefined` for a BRANCH_ADMIN/TEACHER (the server derives their branch
   * from the token - see CLAUDE.md's `AuthenticatedUser.branchScope()`) or
   * for a SCHOOL_ADMIN before the branch list has resolved; otherwise the
   * SCHOOL_ADMIN's currently selected branch.
   */
  branchId?: string;
}

/**
 * The branch a caller's branch-filtered reads (Assessments, Attendance,
 * Reports, Messages, Teachers) should narrow to. Triggers the shared
 * `branchStore` fetch (and its "select the main branch" default) for a
 * SCHOOL_ADMIN only - a BRANCH_ADMIN/TEACHER never needs the branch list at
 * all, since their own branch is already scoped server-side.
 */
export function useBranchScope(): BranchScope {
  const role = useAuthStore((state) => state.user?.role);
  const selectsBranch = can.selectBranch(role);

  const fetchIfNeeded = useBranchStore((state) => state.fetchIfNeeded);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const status = useBranchStore((state) => state.status);

  useEffect(() => {
    if (selectsBranch) {
      fetchIfNeeded();
    }
  }, [selectsBranch, fetchIfNeeded]);

  if (!selectsBranch) {
    return { ready: true };
  }
  return { ready: status === "loaded" || status === "error", branchId: selectedBranchId ?? undefined };
}
