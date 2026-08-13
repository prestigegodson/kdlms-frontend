import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";

interface FilterChipContextValue {
  publish: (key: string, value: string | null) => void;
  unpublish: (key: string) => void;
}

const FilterChipContext = createContext<FilterChipContextValue | null>(null);

/**
 * Publishes one label into the enclosing `collapsible` StickySubHeader's
 * collapsed summary - e.g. `useFilterChip("session", "2025/2026")`. A
 * `null`/`undefined`/empty value marks that filter unset, which is what
 * keeps the panel auto-expanded until every published chip has a value.
 * Insertion order (= mount order) drives the summary's left-to-right order,
 * so a chip-publishing component should mount its chips in the same order
 * it renders its fields. A no-op when the nearest StickySubHeader isn't
 * `collapsible` (or there isn't one), so a shared picker can call this
 * unconditionally regardless of which page hosts it.
 */
export function useFilterChip(key: string, value: string | null | undefined): void {
  const ctx = useContext(FilterChipContext);
  const normalized = value ?? null;
  useEffect(() => {
    if (!ctx) return;
    ctx.publish(key, normalized);
    return () => ctx.unpublish(key);
  }, [ctx, key, normalized]);
}

interface StickySubHeaderProps {
  children: ReactNode;
  /**
   * Below `lg`, collapse the row to a single summary bar (a `·`-joined list
   * of every child's published `useFilterChip` value) with a toggle, rather
   * than always showing every field stacked. Opt in only for a row of three
   * or more *required* selectors, where nothing renders until the selection
   * is complete (`AdminResultsPanel` is the reference) - a row of one or two
   * controls, or a set of optional refinements on an already-populated list
   * (`StudentsPage`'s Search + Filters sheet), should stay plain.
   */
  collapsible?: boolean;
}

/**
 * A page's own selector/filter row, docked under PortalShell's sticky app
 * bar below `lg` and rendering as a plain inline row from `lg` up - the
 * top-edge counterpart to the `sticky bottom-tabbar` save-bar idiom
 * (UnsavedChangesBar / AttendanceRegisterGrid). Full-bleed below `lg` via
 * the same `-mx-4 sm:-mx-6` negative margins that cancel `<main>`'s
 * gutters, then re-padded. `top-16` matches PortalShell's `h-16` header and
 * `z-20` sits under its `z-30`, so page content scrolls behind both.
 *
 * Children stack one per row below `lg` (each a grid child of a single-column
 * grid, so a four-filter row reads top-to-bottom instead of being crushed
 * into a shared width) and fall back to a flex row sharing their own widths
 * from `lg` up. A caller that needs two children side by side even on
 * mobile (a search field paired with a "Filters" button, a row of segmented
 * buttons) wraps them in its own `flex ... lg:contents` div - the same
 * un-boxing trick this component's own `collapsible` panel wrapper uses, so
 * the wrapper's children (not the wrapper itself) rejoin the `lg:flex` row.
 * The caller owns the emptiness guard - render this only once at least one
 * control will actually show, the same contract `WardSelector`'s doc
 * comment already sets.
 *
 * `collapsible` (see the prop doc) additionally collapses that stack behind
 * a toggle below `lg`, auto-opening while any `useFilterChip` is unset and
 * auto-closing the instant the set completes - between those transitions
 * the toggle is fully under the user's control. The field subtree stays
 * mounted while collapsed (`hidden`, not removed), so a picker that fetches
 * its own reference data (`ClassTermPicker`) never re-fetches on expand.
 */
export function StickySubHeader({ children, collapsible = false }: StickySubHeaderProps) {
  const panelId = useId();
  const [chips, setChips] = useState<Map<string, string | null>>(new Map());
  const [open, setOpen] = useState(true);
  const [lastComplete, setLastComplete] = useState(false);

  const publish = useCallback((key: string, value: string | null) => {
    setChips((prev) => (prev.get(key) === value && prev.has(key) ? prev : new Map(prev).set(key, value)));
  }, []);
  const unpublish = useCallback((key: string) => {
    setChips((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);
  const contextValue = useMemo(() => ({ publish, unpublish }), [publish, unpublish]);

  const chipValues = Array.from(chips.values());
  const complete = collapsible && chipValues.length > 0 && chipValues.every((value) => !!value);

  // During-render sync (the `lastSelectionKey`/`lastBranchId` idiom
  // AdminResultsPanel/ClassTermPicker use elsewhere), not an effect: the
  // panel must already be in its new open/closed state by the time this
  // commit paints, not one frame later.
  if (collapsible && complete !== lastComplete) {
    setLastComplete(complete);
    setOpen(!complete);
  }

  const summary = chipValues.filter((value): value is string => !!value).join(" · ") || "Select filters";
  const panelOpen = !collapsible || open;

  return (
    <FilterChipContext.Provider value={collapsible ? contextValue : null}>
      <div className="sticky top-16 z-20 -mx-4 grid gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:z-auto lg:mx-0 lg:flex lg:flex-wrap lg:gap-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-h-11 w-full items-center gap-2 text-left lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <span className={`min-w-0 flex-1 truncate text-sm font-medium ${complete ? "text-slate-900" : "text-slate-500"}`}>
              {summary}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        )}
        <div id={panelId} className={`${panelOpen ? "grid gap-2" : "hidden"} lg:contents`}>
          {children}
        </div>
      </div>
    </FilterChipContext.Provider>
  );
}
