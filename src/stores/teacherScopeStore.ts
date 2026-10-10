import { create } from "zustand";
import { getMyCapabilities, type TeacherCapabilities } from "@/api/me";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface TeacherScopeState {
  capabilities: TeacherCapabilities | null;
  status: FetchStatus;
  /** When capabilities were last fetched successfully - null until the first success. */
  loadedAt: number | null;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** As featureStore's revalidate() - a background refetch when failed or older than `maxAgeMs`. */
  revalidate: (maxAgeMs: number) => Promise<void>;
  reset: () => void;
}

/**
 * Caches the calling TEACHER's class/subject-teacher capabilities
 * (GET /api/v1/me/capabilities) so nav visibility (auth/permissions.ts'
 * `viewAttendance`/`markAttendance`) and teacher-facing pages can share one
 * fetch instead of each re-querying it. Not populated for non-TEACHER roles.
 * SchoolLayout triggers the fetch on mount; authStore's logout() calls
 * reset() so a later, different teacher session in the same tab never
 * inherits a stale answer. A failed fetch keeps the last capabilities that
 * loaded and is retried by revalidate() - see featureStore.ts.
 */
export const useTeacherScopeStore = create<TeacherScopeState>((set, get) => {
  // Bumped by reset(), so a fetch still in flight at logout can't repopulate the next session.
  let generation = 0;

  async function load(): Promise<void> {
    const started = generation;
    set({ status: "loading" });
    try {
      const capabilities = await getMyCapabilities();
      if (started === generation) {
        set({ capabilities, status: "loaded", loadedAt: Date.now() });
      }
    } catch {
      if (started === generation) {
        set({ status: "error" });
      }
    }
  }

  return {
    capabilities: null,
    status: "idle",
    loadedAt: null,

    fetchIfNeeded: async () => {
      if (get().status === "loading" || get().status === "loaded") {
        return;
      }
      await load();
    },

    revalidate: async (maxAgeMs) => {
      const { status, loadedAt } = get();
      if (status === "idle" || status === "loading") {
        return;
      }
      if (status === "loaded" && (loadedAt === null || Date.now() - loadedAt < maxAgeMs)) {
        return;
      }
      await load();
    },

    reset: () => {
      generation++;
      set({ capabilities: null, status: "idle", loadedAt: null });
    },
  };
});

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/authStore.ts's resetAuthStore(). */
export function resetTeacherScopeStore(): void {
  useTeacherScopeStore.getState().reset();
}
