import { create } from "zustand";
import { getPendingJoinRequestCount } from "@/api/joinRequests";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface JoinRequestsPendingState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch - after the tutor acts on a request, so the nav badge updates at once. */
  refresh: () => Promise<void>;
  reset: () => void;
}

async function load(set: (partial: Partial<JoinRequestsPendingState>) => void): Promise<void> {
  set({ status: "loading" });
  try {
    const { count } = await getPendingJoinRequestCount();
    set({ count, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/** The tutor portal's Join requests nav badge - pending requests from their public profile page. */
export const useJoinRequestsPendingStore = create<JoinRequestsPendingState>((set, get) => ({
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

/** Test helper: resets the store to its initial (unfetched) state. */
export function resetJoinRequestsPendingStore(): void {
  useJoinRequestsPendingStore.setState({ count: 0, status: "idle" });
}
