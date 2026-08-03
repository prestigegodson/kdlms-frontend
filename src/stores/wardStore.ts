import { create } from "zustand";
import { listMyWards, type MyWardView } from "@/api/wards";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface WardState {
  wards: MyWardView[];
  selectedWardId: string | null;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. Selects the first ward once loaded, if none is selected yet. */
  fetchIfNeeded: () => Promise<void>;
  select: (studentId: string) => void;
  reset: () => void;
}

/**
 * Caches the calling GUARDIAN's linked wards (GET /api/v1/me/wards) and the
 * currently-selected one, so the ward selector on every guardian page shares
 * one fetch and one selection rather than each re-querying and re-picking
 * independently. Mirrors stores/teacherScopeStore.ts's shape. authStore's
 * logout() calls reset() so a later, different guardian session in the same
 * tab never inherits a stale ward list or selection.
 */
export const useWardStore = create<WardState>((set, get) => ({
  wards: [],
  selectedWardId: null,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const wards = await listMyWards();
      set((state) => ({
        wards,
        status: "loaded",
        selectedWardId: state.selectedWardId ?? wards[0]?.studentId ?? null,
      }));
    } catch {
      set({ wards: [], status: "error" });
    }
  },

  select: (studentId) => set({ selectedWardId: studentId }),

  reset: () => set({ wards: [], selectedWardId: null, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetWardStore(): void {
  useWardStore.setState({ wards: [], selectedWardId: null, status: "idle" });
}
