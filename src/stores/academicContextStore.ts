import { create } from "zustand";
import { listSessions, listTerms } from "@/api/sessions";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface AcademicContextState {
  label: string | null;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  reset: () => void;
}

/**
 * Resolves the school's current session/term name for the topbar's context
 * chip (see PortalShell, SchoolLayout) - read-only and best-effort. There is
 * no dedicated "current session" endpoint, so this walks the sessions list
 * for the one marked current, then that session's terms for the one marked
 * current (CLAUDE.md: at most one current per school, set explicitly by a
 * school admin - never inferred from today's date). Any failure, or nothing
 * marked current yet, degrades to no chip rather than blocking the shell.
 *
 * SCHOOL_ADMIN/BRANCH_ADMIN only - a TEACHER's current term instead comes
 * from stores/teacherScopeStore.ts's capabilities, which already carries it
 * without a second call.
 */
export const useAcademicContextStore = create<AcademicContextState>((set, get) => ({
  label: null,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const sessions = await listSessions(0, 50);
      const currentSession = sessions.content.find((session) => session.current);
      if (!currentSession) {
        set({ label: null, status: "loaded" });
        return;
      }
      const terms = await listTerms(currentSession.id);
      const currentTerm = terms.find((term) => term.current);
      set({
        label: currentTerm ? `${currentSession.name} · ${currentTerm.name}` : currentSession.name,
        status: "loaded",
      });
    } catch {
      set({ label: null, status: "error" });
    }
  },

  reset: () => set({ label: null, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetAcademicContextStore(): void {
  useAcademicContextStore.setState({ label: null, status: "idle" });
}
