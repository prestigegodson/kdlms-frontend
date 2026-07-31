import { create } from "zustand";
import { getMyCapabilities, type TeacherCapabilities } from "@/api/me";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface TeacherScopeState {
  capabilities: TeacherCapabilities | null;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  reset: () => void;
}

/**
 * Caches the calling TEACHER's class/subject-teacher capabilities
 * (GET /api/v1/me/capabilities) so nav visibility (auth/permissions.ts'
 * `viewAttendance`/`markAttendance`) and teacher-facing pages can share one
 * fetch instead of each re-querying it. Not populated for non-TEACHER roles.
 * SchoolLayout triggers the fetch on mount; authStore's logout() calls
 * reset() so a later, different teacher session in the same tab never
 * inherits a stale answer.
 */
export const useTeacherScopeStore = create<TeacherScopeState>((set, get) => ({
  capabilities: null,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const capabilities = await getMyCapabilities();
      set({ capabilities, status: "loaded" });
    } catch {
      set({ capabilities: null, status: "error" });
    }
  },

  reset: () => set({ capabilities: null, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/authStore.ts's resetAuthStore(). */
export function resetTeacherScopeStore(): void {
  useTeacherScopeStore.setState({ capabilities: null, status: "idle" });
}
