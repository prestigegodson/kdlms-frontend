import { create } from "zustand";
import { ApiError } from "@/api/client";
import { listMyWards, type MyWardView } from "@/api/wards";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface WardState {
  wards: MyWardView[];
  selectedWardId: string | null;
  status: FetchStatus;
  errorMessage: string | null;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. Selects the first ward once loaded, if none is selected yet. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch regardless of current status - the Retry action on a failed load. */
  retry: () => Promise<void>;
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
async function load(set: (partial: Partial<WardState>) => void, get: () => WardState) {
  set({ status: "loading", errorMessage: null });
  try {
    const wards = await listMyWards();
    set({
      wards,
      status: "loaded",
      selectedWardId: get().selectedWardId ?? wards[0]?.studentId ?? null,
    });
  } catch (error) {
    set({
      wards: [],
      status: "error",
      errorMessage: error instanceof ApiError ? error.message : "Failed to load your wards",
    });
  }
}

export const useWardStore = create<WardState>((set, get) => ({
  wards: [],
  selectedWardId: null,
  status: "idle",
  errorMessage: null,

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    await load(set, get);
  },

  retry: async () => {
    await load(set, get);
  },

  select: (studentId) => set({ selectedWardId: studentId }),

  reset: () => set({ wards: [], selectedWardId: null, status: "idle", errorMessage: null }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetWardStore(): void {
  useWardStore.setState({ wards: [], selectedWardId: null, status: "idle", errorMessage: null });
}

/**
 * The currently-selected ward's full record (not just its id) - derived
 * rather than stored separately, so it can never drift from `wards`/
 * `selectedWardId`. Lets a docked picker (e.g. `ClassTermPicker`'s guardian
 * analogue) label itself "Ada Obi — Sunrise Academy" once a guardian has
 * wards at more than one school, without re-deriving the lookup at every
 * call site.
 */
export function useSelectedWard(): MyWardView | null {
  return useWardStore((state) => state.wards.find((ward) => ward.studentId === state.selectedWardId) ?? null);
}
