import { create } from "zustand";
import { persist } from "zustand/middleware";

interface InstallPromptState {
  /**
   * The captured `beforeinstallprompt` event, stashed by
   * `utils/installPrompt.ts#captureInstallPrompt` - null on iOS (the event
   * never exists there) and once `promptInstall` has consumed it, since a
   * `BeforeInstallPromptEvent` can only be prompted once.
   */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Set by the `appinstalled` event, or on boot when already running standalone. */
  installed: boolean;
  /** Epoch ms of the last banner dismissal; null if never dismissed. Persisted. */
  dismissedAt: number | null;

  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  markInstalled: () => void;
  dismiss: () => void;
  /** Fires the native install dialog; resolves true if accepted. No-op resolving false when nothing is deferred (e.g. iOS, or already consumed). */
  promptInstall: () => Promise<boolean>;
}

/**
 * Whether/when a user has dismissed the install banner, plus the live
 * `beforeinstallprompt` event once Chromium has offered one - the "small
 * store + persist" shape `navGroupsStore.ts` established, and this store
 * follows its policy too: a device-level chrome preference, deliberately
 * per-browser rather than per-user, so it is NOT cleared by
 * `authStore.logout()`'s reset list (a different account signing in on the
 * same phone shouldn't see the banner reappear just because someone logged
 * out). `partialize` keeps `deferredPrompt` out of localStorage - it holds a
 * live DOM event that isn't serializable and wouldn't survive a reload
 * anyway.
 */
export const useInstallPromptStore = create<InstallPromptState>()(
  persist(
    (set, get) => ({
      deferredPrompt: null,
      installed: false,
      dismissedAt: null,

      setDeferredPrompt: (event) => set({ deferredPrompt: event }),

      markInstalled: () => set({ installed: true, deferredPrompt: null }),

      dismiss: () => set({ dismissedAt: Date.now() }),

      promptInstall: async () => {
        const event = get().deferredPrompt;
        if (!event) {
          return false;
        }
        // Consumed immediately, win or lose - a BeforeInstallPromptEvent can
        // only ever be prompted once; Chromium fires a fresh
        // beforeinstallprompt later if the user declines and stays eligible.
        set({ deferredPrompt: null });
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome === "accepted";
      },
    }),
    {
      name: "kdlms-install-prompt",
      partialize: (state) => ({ dismissedAt: state.dismissedAt }),
    },
  ),
);

/** Test helper: resets the store to its initial (never prompted, never dismissed) state. */
export function resetInstallPromptStore(): void {
  useInstallPromptStore.setState({ deferredPrompt: null, installed: false, dismissedAt: null });
}
