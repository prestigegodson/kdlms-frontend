import { create } from "zustand";
import { getMyFeatures } from "@/api/features";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface FeatureState {
  communication: boolean;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  reset: () => void;
}

/**
 * Caches the calling user's own school's gated feature flags
 * (GET /api/v1/me/features), so the Messages nav item in both the school
 * portal and the guardian portal reads the same fetch rather than each
 * re-querying it. Mirrors stores/teacherScopeStore.ts's shape. Both
 * SchoolLayout and GuardianLayout trigger the fetch on mount; authStore's
 * logout() calls reset() so a later, different session in the same tab
 * never inherits a stale answer.
 */
export const useFeatureStore = create<FeatureState>((set, get) => ({
  communication: false,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const features = await getMyFeatures();
      set({ communication: features.communication, status: "loaded" });
    } catch {
      set({ communication: false, status: "error" });
    }
  },

  reset: () => set({ communication: false, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetFeatureStore(): void {
  useFeatureStore.setState({ communication: false, status: "idle" });
}
