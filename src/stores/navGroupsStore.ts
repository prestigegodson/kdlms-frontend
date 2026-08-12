import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NavGroupsState {
  /**
   * Only groups the user has explicitly toggled - keyed
   * `${portalName}:${groupName}` so School/Guardian/System Admin never
   * collide on a shared group name. Absence means "use the layout's own
   * `defaultOpenGroups`/active-route fallback", not "collapsed" - see
   * PortalShell's `renderNav`.
   */
  collapsed: Record<string, boolean>;
  /**
   * Takes the *new* collapsed value explicitly rather than flipping a
   * stored boolean - a group's displayed open state can come from
   * `defaultOpenGroups`/the active route just as much as from here, so a
   * blind flip of the stored value alone could re-collapse a
   * default-open-by-route group on its first click. PortalShell always
   * calls this with the negation of the group's current *resolved* open
   * state, not with its own stored value.
   */
  setCollapsed: (key: string, collapsed: boolean) => void;
}

/**
 * Persists which sidebar groups (`PortalShell`'s collapsible sections) a
 * user has collapsed, the same "small store + persist" shape `authStore.ts`
 * uses for the session itself - this is the only other piece of durable
 * client state in the app. Deliberately per-browser rather than per-user:
 * it isn't cleared by `authStore.logout()`, since a chrome preference isn't
 * server-scoped data that a different account signing in next should never
 * inherit.
 */
export const useNavGroupsStore = create<NavGroupsState>()(
  persist(
    (set, get) => ({
      collapsed: {},

      setCollapsed: (key, collapsed) => {
        set({ collapsed: { ...get().collapsed, [key]: collapsed } });
      },
    }),
    {
      name: "kdlms-nav-groups",
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
);

/** Test helper: resets the store to its initial (nothing toggled) state. */
export function resetNavGroupsStore(): void {
  useNavGroupsStore.setState({ collapsed: {} });
}
