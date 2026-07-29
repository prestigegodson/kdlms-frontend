import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import type { Role } from "@/api/types";
import { UserMenu } from "@/layouts/UserMenu";
import { useAuthStore } from "@/stores/authStore";

export interface NavItem {
  label: string;
  href: string;
  /** Restricts this item to the given roles within the portal; omit to show it to everyone who reaches the portal. */
  roles?: Role[];
}

interface PortalShellProps {
  portalName: string;
  navItems: NavItem[];
  /** Rendered above the routed content, e.g. the school portal's subscription plan/limits/expiry banner. */
  banner?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared sidebar + header chrome for a portal. The three portal layouts
 * (system admin, school, guardian) each pass their own name and nav items;
 * routed content renders via <Outlet /> unless children are supplied.
 * Nav items are filtered by the current user's role (CLAUDE.md's
 * "navigation by role"), and the header shows who's signed in via the
 * account menu (see UserMenu) - a profile avatar that opens a dropdown with
 * the user's name/role and their account actions (change password, log
 * out), rather than bare buttons in the header itself.
 */
export function PortalShell({ portalName, navItems, banner, children }: PortalShellProps) {
  const user = useAuthStore((state) => state.user);

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-gray-200 bg-white">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <span className="text-lg font-semibold text-brand-700">KDLMS</span>
        </div>
        <nav className="p-4">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {portalName}
          </p>
          <ul className="mt-2 space-y-1">
            {visibleNavItems.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.href.split("/").length <= 2}
                  className={({ isActive }) =>
                    `block rounded-md px-2 py-1.5 text-sm ${
                      isActive
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex h-16 items-center justify-end gap-4 border-b border-gray-200 bg-white px-6">
          {user ? <UserMenu user={user} /> : <span className="text-sm text-gray-500">Not signed in</span>}
        </header>
        <main className="p-6">
          {banner}
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
