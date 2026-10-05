import { create } from "zustand";
import { getCreatorUnreadCount, getMemberUnreadCount } from "@/api/classMessages";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

/** Which class-messages unread count to read (creators Phase C11). */
export type ClassMessagesAudience = "CREATOR" | "LEARNER" | "GUARDIAN";

interface ClassMessagesUnreadState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: (audience: ClassMessagesAudience) => Promise<void>;
  /** Forces a re-fetch - after sending to or reading a conversation, so the nav badge updates at once. */
  refresh: (audience: ClassMessagesAudience) => Promise<void>;
  reset: () => void;
}

async function load(
  audience: ClassMessagesAudience,
  set: (partial: Partial<ClassMessagesUnreadState>) => void,
): Promise<void> {
  set({ status: "loading" });
  try {
    const view = audience === "CREATOR" ? await getCreatorUnreadCount() : await getMemberUnreadCount(audience);
    set({ count: view.unreadThreads, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/**
 * The class-messages nav badge for a creator, a learner, or a guardian following a creator's
 * learner. Kept apart from unreadMessagesStore (the school threads' badge) because a guardian can
 * hold both counts at once - their wards' school messages and their learners' class messages.
 */
export const useClassMessagesUnreadStore = create<ClassMessagesUnreadState>((set, get) => ({
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
export function resetClassMessagesUnreadStore(): void {
  useClassMessagesUnreadStore.setState({ count: 0, status: "idle" });
}
