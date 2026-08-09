import type { ReactNode } from "react";
import { useId, useLayoutEffect } from "react";
import { useAppBarStore } from "@/stores/appBarStore";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /**
   * Where the mobile app bar's back chevron (below `lg`) returns to -
   * detail routes only; a list page omits this and gets the brand mark
   * instead. Has no effect at `lg` and above, where the sidebar is back
   * enough.
   */
  backTo?: string;
}

/**
 * The title + description + primary-actions row repeated at the top of
 * every list/detail page - replaces each page's own `h1` plus `flex
 * items-center justify-between` block so page headers can't drift in size
 * or spacing across pages. Stacks below `sm` so a long title or multiple
 * actions never squeeze each other.
 *
 * Also publishes `title`/`backTo` into `appBarStore` so PortalShell's
 * mobile app bar (below `lg`) can show them in its sticky header - the
 * `<h1>` here stays the one accessible heading at every width (`sr-only`
 * below `lg`, visible at `lg`+) rather than being duplicated, since the app
 * bar's own title is `aria-hidden`.
 */
export function PageHeader({ title, description, actions, backTo }: PageHeaderProps) {
  const ownerId = useId();
  const claim = useAppBarStore((state) => state.claim);
  const release = useAppBarStore((state) => state.release);

  // Publish on mount and whenever title/backTo change.
  useLayoutEffect(() => {
    claim(ownerId, title, backTo ?? null);
  }, [ownerId, title, backTo, claim]);

  // Relinquish only on unmount - never on a prop change, so an edited title
  // can't flash empty in between. `release` itself is a no-op unless this
  // instance is still the current owner, so an interleaved mount/unmount
  // during a route change can never clobber the next page's title.
  useLayoutEffect(() => {
    return () => release(ownerId);
  }, [ownerId, release]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="sr-only font-display text-3xl font-medium text-slate-900 lg:not-sr-only">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
