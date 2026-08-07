import { create } from "zustand";
import { getUnreadCount, getWardUnreadCount } from "@/api/communication";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

/** Which unread-count endpoint to read - a TEACHER's own classes, or a GUARDIAN's linked wards. */
export type UnreadAudience = "TEACHER" | "GUARDIAN";

interface UnreadMessagesState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: (audience: UnreadAudience) => Promise<void>;
  /** Forces a re-fetch - called after sending, replying to, or reading a thread so the nav badge updates immediately. */
  refresh: (audience: UnreadAudience) => Promise<void>;
  reset: () => void;
}

async function load(
  audience: UnreadAudience,
  set: (partial: Partial<UnreadMessagesState>) => void,
): Promise<void> {
  set({ status: "loading" });
  try {
    const view = audience === "TEACHER" ? await getUnreadCount() : await getWardUnreadCount();
    set({ count: view.unreadThreads, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/**
 * The Messages nav badge count, for either a TEACHER (unread across every
 * class they class-teach) or a GUARDIAN (unread across every linked ward).
 * Mirrors stores/teacherScopeStore.ts's shape; authStore's logout() calls
 * reset() so a later, different session in the same tab never inherits a
 * stale count.
 */
export const useUnreadMessagesStore = create<UnreadMessagesState>((set, get) => ({
  count: 0,
  status: "idle",

  fetchIfNeeded: async (audience) => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    await load(audience, set);
  },

  refresh: async (audience) => {
    await load(audience, set);
  },

  reset: () => set({ count: 0, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state. */
export function resetUnreadMessagesStore(): void {
  useUnreadMessagesStore.setState({ count: 0, status: "idle" });
}
