import { create } from "zustand";
import { listLevels, type LevelView } from "@/api/levels";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface LevelState {
  levels: LevelView[];
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a refetch - call after create/rename/reorder/activate/deactivate/delete so every
   *  consumer (LevelSelect, the Levels page) sees the change without a page reload. */
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * The caller's school's levels, ordered by rank - shared across every
 * level-aware screen (Subjects, Classes, the Levels admin page) so a rename
 * or reorder shows up everywhere without each page holding its own copy.
 */
export const useLevelStore = create<LevelState>((set, get) => ({
  levels: [],
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const levels = await listLevels();
      set({ levels, status: "loaded" });
    } catch {
      set({ levels: [], status: "error" });
    }
  },

  refresh: async () => {
    set({ status: "loading" });
    try {
      const levels = await listLevels();
      set({ levels, status: "loaded" });
    } catch {
      set({ levels: [], status: "error" });
    }
  },

  reset: () => set({ levels: [], status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/academicContextStore.ts's resetAcademicContextStore(). */
export function resetLevelStore(): void {
  useLevelStore.setState({ levels: [], status: "idle" });
}
