import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";

interface AccordionProps {
  title: string;
  /**
   * Starts expanded. With `collapsible="mobile"` this only matters below `md`, where the panel is
   * always expanded; with `collapsible="always"` it applies at every size.
   */
  defaultOpen?: boolean;
  /** `"mobile"` (default) collapses only below `md`; `"always"` collapses at every screen size. */
  collapsible?: "mobile" | "always";
  /** Rendered alongside the title, outside the toggle button so its own clicks never collapse the panel. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A `Card`-shaped panel that collapses below `md` and is otherwise an
 * ordinary always-expanded card - the mobile-plan.md Phase D shape for a
 * detail page with several stacked sections (`StudentDetailPage`'s
 * Guardians/Enrollment/Medical/Attendance panels). Deliberately CSS-gated,
 * not `matchMedia`-gated: the body never leaves the DOM, so no test needs a
 * `matchMedia` stub (mobile-plan.md's Verification note) and the content is
 * always there for a search-in-page or a screen reader that ignores layout.
 * The one accepted tradeoff of that approach: the header button is inert
 * from `md` up (`pointer-events-none`) rather than driven by a real
 * breakpoint check, since toggling `open` there wouldn't change anything
 * visible anyway - the body's `mobile:hidden` class only ever applies below
 * the `mobile` variant's 767.98px. `collapsible="always"` opts out of that and
 * makes the panel collapse at every size (still CSS-gated, via `hidden`).
 */
export function Accordion({
  title,
  defaultOpen = false,
  collapsible = "mobile",
  actions,
  children,
  className = "",
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const always = collapsible === "always";

  return (
    <div className={`rounded-card border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 p-6 pb-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className={`flex min-h-14 flex-1 items-center justify-between gap-2 py-1 text-left ${
            always ? "cursor-pointer" : "cursor-default pointer-events-none mobile:cursor-pointer mobile:pointer-events-auto"
          }`}
        >
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${always ? "block" : "hidden mobile:block"} ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div id={bodyId} className={`p-6 ${open ? "" : always ? "hidden" : "mobile:hidden"}`}>
        {children}
      </div>
    </div>
  );
}
