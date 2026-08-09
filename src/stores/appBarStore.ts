import { create } from "zustand";

interface AppBarState {
  /** The mounted PageHeader's title, mirrored into the mobile app bar; null when no page has one. */
  title: string | null;
  /** Where the mobile back chevron points; null hides it. */
  backTo: string | null;
  /**
   * Identity of the PageHeader instance that last published, so a stale
   * unmount can never clobber a page that has already taken over - see
   * `claim`/`release` below.
   */
  ownerId: string | null;
  claim: (ownerId: string, title: string, backTo: string | null) => void;
  /** No-op unless `ownerId` is still the current owner - a late unmount can't wipe the incoming page's title. */
  release: (ownerId: string) => void;
}

/**
 * Mirrors a page's `PageHeader` title/back-target into the mobile app bar
 * (`PortalShell`'s `MobileAppBar`), the same "small store + effect" shape
 * `unreadMessagesStore.ts` uses. React effect ordering across a route change
 * isn't guaranteed to run the outgoing page's cleanup before the incoming
 * page's mount, so ownership is tracked explicitly rather than trusting
 * effect order: `claim` always wins, `release` only clears if it's still the
 * current owner.
 */
export const useAppBarStore = create<AppBarState>((set, get) => ({
  title: null,
  backTo: null,
  ownerId: null,

  claim: (ownerId, title, backTo) => {
    const state = get();
    if (state.ownerId === ownerId && state.title === title && state.backTo === backTo) {
      return;
    }
    set({ ownerId, title, backTo });
  },

  release: (ownerId) => {
    if (get().ownerId !== ownerId) {
      return;
    }
    set({ ownerId: null, title: null, backTo: null });
  },
}));

/** Test helper: resets the store to its initial (no page mounted) state. */
export function resetAppBarStore(): void {
  useAppBarStore.setState({ title: null, backTo: null, ownerId: null });
}
