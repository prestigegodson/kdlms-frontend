import { create } from "zustand";
import { getPendingLessonNoteCount } from "@/api/lessonNotes";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface PendingLessonNotesState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch - called after submit/withdraw/review/reopen so the nav badge updates immediately. */
  refresh: () => Promise<void>;
  reset: () => void;
}

async function load(set: (partial: Partial<PendingLessonNotesState>) => void): Promise<void> {
  set({ status: "loading" });
  try {
    const view = await getPendingLessonNoteCount();
    set({ count: view.pendingReview, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/**
 * The Lesson notes nav badge count for a SCHOOL_ADMIN/BRANCH_ADMIN - SUBMITTED notes awaiting
 * review, school-wide. Mirrors stores/unreadMessagesStore.ts's shape; authStore's logout() calls
 * reset() so a later, different session in the same tab never inherits a stale count.
 */
export const usePendingLessonNotesStore = create<PendingLessonNotesState>((set, get) => ({
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
export function resetPendingLessonNotesStore(): void {
  usePendingLessonNotesStore.setState({ count: 0, status: "idle" });
}
