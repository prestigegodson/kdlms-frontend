import type { LucideIcon } from "lucide-react";
import { Menu, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import type { Role } from "@/api/types";
import { UserMenu } from "@/layouts/UserMenu";
import { useAuthStore } from "@/stores/authStore";

export interface NavItem {
  label: string;
  href: string;
  icon?: LucideIcon;
  /**
   * Sidebar section this item renders under (e.g. "Academics", "People"),
   * mirroring the backend module split in CLAUDE.md so grouping encodes
   * real structure rather than decorating. Items without a group render
   * ungrouped, above any grouped ones.
   */
  group?: string;
  /** Restricts this item to the given roles within the portal; omit to show it to everyone who reaches the portal. */
  roles?: Role[];
  /**
   * An additional gate evaluated alongside `roles`, for visibility that
   * role membership alone can't express - e.g. Attendance is TEACHER-visible
   * only for a class teacher, never a subject-teacher-only account (see
   * auth/permissions.ts). Omit when `roles` is sufficient on its own.
   */
  visible?: () => boolean;
}

interface PortalShellProps {
  portalName: string;
  navItems: NavItem[];
  /**
   * A short, factual label for the topbar's context chip - e.g. the
   * school's current session/term ("2026/2027 · Term 2"). Every recorded
   * score, rating and attendance mark is filed under a term, so naming it
   * here keeps that context visible everywhere without repeating it on
   * every page. Omit for portals with no such context (system admin,
   * guardian).
   */
  contextLabel?: ReactNode;
  /** Rendered above the routed content, e.g. the school portal's subscription plan/limits/expiry banner. */
  banner?: ReactNode;
  children?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared sidebar + header chrome for a portal. The three portal layouts
 * (system admin, school, guardian) each pass their own name and nav items;
 * routed content renders via <Outlet /> unless children are supplied.
 * Nav items are filtered by the current user's role (CLAUDE.md's
 * "navigation by role") and grouped into sections, and the header shows
 * who's signed in via the account menu (see UserMenu).
 *
 * Below the `lg` breakpoint the sidebar becomes an off-canvas drawer opened
 * by a hamburger button, reusing components/ui/Modal.tsx's focus-trap and
 * Escape-to-close pattern since it is functionally the same kind of modal
 * overlay.
 */
export function PortalShell({ portalName, navItems, contextLabel, banner, children }: PortalShellProps) {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPathname, setDrawerPathname] = useState(location.pathname);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.roles || (user && item.roles.includes(user.role))) && (!item.visible || item.visible()),
  );

  const groups: { name: string | null; items: NavItem[] }[] = [];
  for (const item of visibleNavItems) {
    const groupName = item.group ?? null;
    let group = groups.find((candidate) => candidate.name === groupName);
    if (!group) {
      group = { name: groupName, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  // Which single nav item is "active" for the current pathname. Deciding this
  // per-link (e.g. via NavLink's own isActive) breaks down whenever one
  // item's href is a path prefix of another's - e.g. "Assessments"
  // (/school/assessments) and "Grading systems"
  // (/school/assessments/grading) - because both links would independently
  // match and highlight at once. Instead we look at the whole nav set here
  // and pick the longest href that matches, so the most specific item wins.
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const activeHref = visibleNavItems
    .filter((item) => {
      if (pathname === item.href) {
        return true;
      }
      // Only treat an item as matching a descendant route once it's deeper
      // than the portal root - otherwise the Dashboard link (e.g. "/school")
      // would light up for every page in the portal.
      return item.href.split("/").length > 2 && pathname.startsWith(`${item.href}/`);
    })
    .reduce<string | null>(
      (longest, item) => (longest === null || item.href.length > longest.length ? item.href : longest),
      null,
    );

  // Close the drawer on every navigation so a link tap doesn't leave it open
  // behind the new page. Adjusted during render rather than in an effect -
  // this is the "reset state when a prop changes" case React's docs call
  // out (https://react.dev/learn/you-might-not-need-an-effect) - so there's
  // no extra render-then-close flash.
  if (location.pathname !== drawerPathname) {
    setDrawerPathname(location.pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }
    drawerRef.current?.focus();
    const hamburger = hamburgerRef.current;
    return () => hamburger?.focus();
  }, [drawerOpen]);

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setDrawerOpen(false);
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function renderNav() {
    return (
      <nav className="flex-1 overflow-y-auto p-4">
        {groups.map((group, index) => (
          <div key={group.name ?? `ungrouped-${index}`} className={index > 0 ? "mt-6" : ""}>
            {group.name && (
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.name}
              </p>
            )}
            <ul className={group.name ? "mt-2 space-y-1" : "space-y-1"}>
              {group.items.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-brand-50 font-medium text-brand-800"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {item.icon && <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop rail */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-6">
          <span className="font-display text-lg font-medium text-brand-800">KDLMS</span>
        </div>
        <p className="px-6 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {portalName}
        </p>
        {renderNav()}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${portalName} navigation`}
            tabIndex={-1}
            onKeyDown={handleDrawerKeyDown}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl outline-none"
          >
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <span className="font-display text-lg font-medium text-brand-800">KDLMS</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-control text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 px-6 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{portalName}</p>
              {contextLabel && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                  {contextLabel}
                </span>
              )}
            </div>
            {renderNav()}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="font-display text-base font-medium text-brand-800 lg:hidden">KDLMS</span>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:justify-between">
            {contextLabel ? (
              <span className="hidden truncate rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800 sm:inline-flex">
                {contextLabel}
              </span>
            ) : (
              <span className="hidden sm:inline-flex" />
            )}
            {user ? <UserMenu user={user} /> : <span className="text-sm text-slate-500">Not signed in</span>}
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            {banner}
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
