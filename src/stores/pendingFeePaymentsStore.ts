import { create } from "zustand";
import { getPendingPaymentCount } from "@/api/staffFeePayments";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface PendingFeePaymentsState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch - called after a review/record/void/correct so the badges update immediately. */
  refresh: () => Promise<void>;
  reset: () => void;
}

async function load(set: (partial: Partial<PendingFeePaymentsState>) => void): Promise<void> {
  set({ status: "loading" });
  try {
    const view = await getPendingPaymentCount();
    set({ count: view.count, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/**
 * The Fees & Bills nav badge and Payments tab badge for a SCHOOL_ADMIN/BRANCH_ADMIN (Phase 45I,
 * D16's "in-app pending badge only") - pending children awaiting review, school-wide for a
 * SCHOOL_ADMIN and own-branch for a BRANCH_ADMIN (derived server-side). Mirrors
 * stores/pendingLessonNotesStore.ts; authStore's logout() calls reset().
 */
export const usePendingFeePaymentsStore = create<PendingFeePaymentsState>((set, get) => ({
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
export function resetPendingFeePaymentsStore(): void {
  usePendingFeePaymentsStore.setState({ count: 0, status: "idle" });
}
