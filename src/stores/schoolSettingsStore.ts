import { create } from "zustand";
import { getSchoolSettings, type SchoolSettingsView } from "@/api/schoolSettings";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface SchoolSettingsState {
  settings: SchoolSettingsView | null;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  reset: () => void;
}

/**
 * Caches the caller's school-wide operational policy (GET
 * /api/v1/school/settings) - today just `allowWeekendAttendance`, which the
 * attendance date picker needs to know whether to grey out Saturdays and
 * Sundays. Readable by SCHOOL_ADMIN, BRANCH_ADMIN, and TEACHER alike (see
 * SchoolSettingsController), so SchoolLayout triggers the fetch for all
 * three rather than only admins, mirroring teacherScopeStore's pattern.
 * authStore's logout() calls reset() so a later, different school's session
 * in the same tab never inherits a stale answer.
 */
export const useSchoolSettingsStore = create<SchoolSettingsState>((set, get) => ({
  settings: null,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const settings = await getSchoolSettings();
      set({ settings, status: "loaded" });
    } catch {
      set({ settings: null, status: "error" });
    }
  },

  reset: () => set({ settings: null, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetSchoolSettingsStore(): void {
  useSchoolSettingsStore.setState({ settings: null, status: "idle" });
}
