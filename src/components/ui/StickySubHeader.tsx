import type { ReactNode } from "react";

/**
 * A page's own selector/filter row, docked under PortalShell's sticky app
 * bar below `lg` and rendering as a plain inline row from `lg` up - the
 * top-edge counterpart to the `sticky bottom-tabbar` save-bar idiom
 * (UnsavedChangesBar / AttendanceRegisterGrid). Full-bleed below `lg` via
 * the same `-mx-4 sm:-mx-6` negative margins that cancel `<main>`'s
 * gutters, then re-padded. `top-16` matches PortalShell's `h-16` header and
 * `z-20` sits under its `z-30`, so page content scrolls behind both.
 *
 * Children share the row equally on mobile (each a flex child of an
 * unwrapped row) and fall back to their own widths from `lg`. The caller
 * owns the emptiness guard - render this only once at least one control
 * will actually show, the same contract `WardSelector`'s doc comment
 * already sets.
 */
export function StickySubHeader({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-16 z-20 -mx-4 flex gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:z-auto lg:mx-0 lg:flex-wrap lg:gap-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      {children}
    </div>
  );
}
