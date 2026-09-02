import { useState } from "react";
import type { BranchView } from "@/api/branches";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useBranchStore } from "@/stores/branchStore";

export interface BranchFilterState {
  /** False only while a SCHOOL_ADMIN's branch list is still resolving - hold off fetching. */
  ready: boolean;
  /** The school's branches, for rendering the picker's options. Empty for a BRANCH_ADMIN/TEACHER. */
  branches: BranchView[];
  /** "" means all branches. Seeded from branchStore's main-branch pick. */
  branchId: string;
  /** The store's auto-selected main branch - compare against it to detect a deliberate deviation. */
  defaultBranchId: string;
  setBranchId: (branchId: string) => void;
}

/**
 * The "All branches"-capable counterpart to {@link useBranchScope} - for a picker (Classes,
 * Students) that must keep an unscoped "All branches" option, unlike the six branch-filtered
 * pages (Assessments/Attendance/Reports/Messages/Teachers/Timetable) that write straight into
 * `branchStore` via `components/BranchFilter.tsx`, which has no concept of "all". Still reuses
 * `useBranchScope`'s main-branch default and its `ready` gate rather than re-deriving either.
 */
export function useBranchFilter(): BranchFilterState {
  const { ready, branchId: scopedBranchId } = useBranchScope();
  const branches = useBranchStore((state) => state.branches);
  const defaultBranchId = scopedBranchId ?? "";

  const [override, setOverride] = useState<string | null>(null);

  return {
    ready,
    branches,
    branchId: override ?? defaultBranchId,
    defaultBranchId,
    setBranchId: setOverride,
  };
}
