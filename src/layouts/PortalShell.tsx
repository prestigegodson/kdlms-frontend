import type { ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import type { Role } from "@/api/types";
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
  children?: ReactNode;
}

/**
 * Shared sidebar + header chrome for a portal. The three portal layouts
 * (system admin, school, guardian) each pass their own name and nav items;
 * routed content renders via <Outlet /> unless children are supplied.
 * Nav items are filtered by the current user's role (CLAUDE.md's
 * "navigation by role"), and the header shows who's signed in with a
 * logout action.
 */
export function PortalShell({ portalName, navItems, children }: PortalShellProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const visibleNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

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
          {user ? (
            <>
              <span className="text-sm text-gray-700">
                {user.firstName} {user.lastName}
                <span className="ml-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {user.role}
                </span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                Log out
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-500">Not signed in</span>
          )}
        </header>
        <main className="p-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
