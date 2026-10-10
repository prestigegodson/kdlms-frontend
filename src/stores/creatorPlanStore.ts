import { create } from "zustand";
import { type CreatorPlanView, getMyCreatorPlan } from "@/api/creatorPlan";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface CreatorPlanState {
  plan: CreatorPlanView | null;
  status: FetchStatus;
  /** When the plan was last fetched successfully - null until the first success. */
  loadedAt: number | null;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** As featureStore's revalidate() - a background refetch when failed or older than `maxAgeMs`. */
  revalidate: (maxAgeMs: number) => Promise<void>;
  reset: () => void;
}

/**
 * The creator's own effective plan, for the creator portal's feature-gated nav items (creators
 * Phase C11 onward) - the creator-side counterpart of featureStore, which serves the school and
 * guardian portals. CreatorPlanCard keeps its own fetch, since it must show a fresh plan after a
 * checkout. A failed fetch keeps the last plan that loaded and is retried by revalidate() - see
 * featureStore.ts.
 */
export const useCreatorPlanStore = create<CreatorPlanState>((set, get) => {
  // Bumped by reset(), so a fetch still in flight at logout can't repopulate the next session.
  let generation = 0;

  async function load(): Promise<void> {
    const started = generation;
    set({ status: "loading" });
    try {
      const plan = await getMyCreatorPlan();
      if (started === generation) {
        set({ plan, status: "loaded", loadedAt: Date.now() });
      }
    } catch {
      if (started === generation) {
        set({ status: "error" });
      }
    }
  }

  return {
    plan: null,
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
      set({ plan: null, status: "idle", loadedAt: null });
    },
  };
});

/** Test helper: resets the store to its initial (unfetched) state. */
export function resetCreatorPlanStore(): void {
  useCreatorPlanStore.getState().reset();
}
