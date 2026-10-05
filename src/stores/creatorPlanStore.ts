import { create } from "zustand";
import { type CreatorPlanView, getMyCreatorPlan } from "@/api/creatorPlan";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface CreatorPlanState {
  plan: CreatorPlanView | null;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  reset: () => void;
}

/**
 * The creator's own effective plan, for the creator portal's feature-gated nav items (creators
 * Phase C11 onward) - the creator-side counterpart of featureStore, which serves the school and
 * guardian portals. CreatorPlanCard keeps its own fetch, since it must show a fresh plan after a
 * checkout.
 */
export const useCreatorPlanStore = create<CreatorPlanState>((set, get) => ({
  plan: null,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      set({ plan: await getMyCreatorPlan(), status: "loaded" });
    } catch {
      set({ plan: null, status: "error" });
    }
  },

  reset: () => set({ plan: null, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state. */
export function resetCreatorPlanStore(): void {
  useCreatorPlanStore.setState({ plan: null, status: "idle" });
}
