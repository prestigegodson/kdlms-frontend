import { create } from "zustand";
import { ApiError } from "@/api/client";
import { getMyStudent, listMyTerms, type MyStudentView, type StudentTermView } from "@/api/student";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface StudentState {
  me: MyStudentView | null;
  terms: StudentTermView[];
  status: FetchStatus;
  errorMessage: string | null;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch regardless of current status - the Retry action on a failed load. */
  retry: () => Promise<void>;
  reset: () => void;
}

/**
 * Caches the calling STUDENT's own profile (GET /api/v1/me/student) and term history
 * (GET /api/v1/me/terms), so the portal shell and every page share one fetch rather than each
 * re-querying independently - the `stores/wardStore.ts` shape, minus the ward selector (a
 * STUDENT has exactly one profile, no picker). authStore's logout() calls reset() so a later,
 * different student session in the same tab never inherits a stale profile.
 */
async function load(set: (partial: Partial<StudentState>) => void) {
  set({ status: "loading", errorMessage: null });
  try {
    const [me, terms] = await Promise.all([getMyStudent(), listMyTerms()]);
    set({ me, terms, status: "loaded" });
  } catch (error) {
    set({
      me: null,
      terms: [],
      status: "error",
      errorMessage: error instanceof ApiError ? error.message : "Failed to load your profile",
    });
  }
}

export const useStudentStore = create<StudentState>((set, get) => ({
  me: null,
  terms: [],
  status: "idle",
  errorMessage: null,

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    await load(set);
  },

  retry: async () => {
    await load(set);
  },

  reset: () => set({ me: null, terms: [], status: "idle", errorMessage: null }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/wardStore.ts's resetWardStore(). */
export function resetStudentStore(): void {
  useStudentStore.setState({ me: null, terms: [], status: "idle", errorMessage: null });
}
