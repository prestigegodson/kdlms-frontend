import { create } from "zustand";
import { type BranchView, listBranches } from "@/api/branches";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface BranchState {
  branches: BranchView[];
  selectedBranchId: string | null;
  status: FetchStatus;
  /**
   * Fetches once per session; a repeat call while loaded/loading is a
   * no-op. On first load, auto-selects the school's main branch (falling
   * back to the first active one, then the first of any) so a SCHOOL_ADMIN
   * lands on Assessments/Attendance/Reports/Messages/Teachers with data
   * already loaded rather than an empty "pick a branch" state.
   */
  fetchIfNeeded: () => Promise<void>;
  select: (branchId: string) => void;
  reset: () => void;
}

/**
 * The caller's school's branches, plus the one currently selected for the
 * five branch-filtered school-portal pages (Assessments, Attendance,
 * Reports, Messages, Teachers) - shared so a SCHOOL_ADMIN's pick on one page
 * carries over to the next rather than being re-chosen each time. Only a
 * SCHOOL_ADMIN drives `select`; a BRANCH_ADMIN/TEACHER never fetches this at
 * all (see features/branches/useBranchScope.ts, which derives their branch
 * from the token instead). Mirrors stores/levelStore.ts's fetch shape.
 */
export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [],
  selectedBranchId: null,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const page = await listBranches();
      const branches = page.content;
      const preferred =
        branches.find((branch) => branch.main && branch.status === "ACTIVE") ??
        branches.find((branch) => branch.status === "ACTIVE") ??
        branches[0];
      set({ branches, selectedBranchId: preferred?.id ?? null, status: "loaded" });
    } catch {
      set({ branches: [], selectedBranchId: null, status: "error" });
    }
  },

  select: (branchId) => set({ selectedBranchId: branchId }),

  reset: () => set({ branches: [], selectedBranchId: null, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/levelStore.ts's resetLevelStore(). */
export function resetBranchStore(): void {
  useBranchStore.setState({ branches: [], selectedBranchId: null, status: "idle" });
}
