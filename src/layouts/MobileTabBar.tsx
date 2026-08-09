import { Menu } from "lucide-react";
import type { RefObject } from "react";
import { Link } from "react-router";
import type { Role } from "@/api/types";
import type { NavItem } from "@/layouts/PortalShell";

interface MobileTabBarProps {
  /** Already role/`visible()`-filtered by PortalShell - never re-filtered on those here. */
  items: NavItem[];
  /** The signed-in user's role, for the `primary` membership test. */
  role: Role | undefined;
  /** PortalShell's longest-prefix result - reused as-is, never re-derived. */
  activeHref: string | null;
  onMore: () => void;
  moreRef: RefObject<HTMLButtonElement | null>;
  drawerOpen: boolean;
  portalName: string;
}

/**
 * The bottom tab bar shown below `lg`, replacing the hamburger as the one
 * mobile nav affordance alongside the drawer it opens (mobile-plan.md
 * A1). Renders up to 4 of `items` whose `primary` includes the current
 * role, in nav order, then a 5th "More" tab that opens PortalShell's
 * existing drawer - omitted when every visible item already has a tab (see
 * `SystemAdminLayout`, whose 4 items are all primary).
 */
export function MobileTabBar({
  items,
  role,
  activeHref,
  onMore,
  moreRef,
  drawerOpen,
  portalName,
}: MobileTabBarProps) {
  const tabs = role ? items.filter((item) => item.primary?.includes(role)).slice(0, 4) : [];
  const showMore = items.length > tabs.length;
  // "More" reads as active whenever the current page isn't one of the tabs
  // shown, so the tab bar always shows exactly one active affordance.
  const moreActive = showMore && (drawerOpen || !tabs.some((item) => item.href === activeHref));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {tabs.map((item) => {
        const isActive = item.href === activeHref;
        const hasBadge = !!item.badge?.();
        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
              isActive ? "text-brand-600" : "text-slate-500"
            }`}
          >
            <span className="relative">
              {item.icon && <item.icon className="h-5 w-5" aria-hidden="true" />}
              {hasBadge && (
                <span
                  className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand-500"
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
      {showMore && (
        <button
          ref={moreRef}
          type="button"
          onClick={onMore}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-label={`More, ${portalName} navigation`}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
            moreActive ? "text-brand-600" : "text-slate-500"
          }`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span>More</span>
        </button>
      )}
    </nav>
  );
}
