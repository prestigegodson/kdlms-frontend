import { create } from "zustand";
import { getUnreadContactEnquiryCount } from "@/api/contactEnquiries";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface ContactEnquiriesUnreadState {
  count: number;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /** Forces a re-fetch - after opening, re-marking or deleting an enquiry, so the badge updates at once. */
  refresh: () => Promise<void>;
  reset: () => void;
}

async function load(set: (partial: Partial<ContactEnquiriesUnreadState>) => void): Promise<void> {
  set({ status: "loading" });
  try {
    const view = await getUnreadContactEnquiryCount();
    set({ count: view.count, status: "loaded" });
  } catch {
    set({ count: 0, status: "error" });
  }
}

/**
 * The system admin's Enquiries nav badge - public "contact us" enquiries nobody has opened yet.
 * Mirrors stores/pendingFeePaymentsStore.ts; authStore's logout() calls reset().
 */
export const useContactEnquiriesUnreadStore = create<ContactEnquiriesUnreadState>((set, get) => ({
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
