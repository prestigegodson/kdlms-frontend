import { create } from "zustand";
import { getMyUnopenedResourceCount } from "@/api/learning";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface NewResourcesState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch - called once a resource's open ping lands so the nav badge drops immediately. */
  refresh: () => Promise<void>;
  reset: () => void;
}

async function load(set: (partial: Partial<NewResourcesState>) => void): Promise<void> {
  set({ status: "loading" });
  try {
    const view = await getMyUnopenedResourceCount();
    set({ count: view.count, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/**
 * The student Resources nav badge - how many visible resources the student has never opened.
 * Mirrors stores/unreadMessagesStore.ts's shape; authStore's logout() calls reset() so a later,
 * different session in the same tab never inherits a stale count.
 */
export const useNewResourcesStore = create<NewResourcesState>((set, get) => ({
  count: 0,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    await load(set);
  },

  refresh: async () => {
    await load(set);
  },

  reset: () => set({ count: 0, status: "idle" }),
}));
