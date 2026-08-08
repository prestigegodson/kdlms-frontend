import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import type { Role } from "@/api/types";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

interface RequireRoleProps {
  roles: Role[];
  children: ReactNode;
}

/**
 * Route guard reading role + auth state from the Zustand auth store. No
 * session -> redirect to /login, remembering where the user was headed so
 * login can send them back. Still holding a system-generated temporary
 * password -> redirect to /set-password, ahead of the role check, so this
 * one edit covers all three portals rather than each needing its own copy
 * of the check; the real enforcement is server-side
 * (shared.config.PasswordChangeGuardFilter), this is only the UX shortcut
 * that keeps a flagged user from bouncing off a 403 first. Wrong role ->
 * redirect to *that role's own* home rather than /login, which would just
 * bounce them straight back here in a loop. Renders nothing until the
 * persisted session has been read from storage (see authStore's
 * `hydrated`), to avoid a flash-redirect on reload.
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const location = useLocation();

  if (!hydrated) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/set-password" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return <>{children}</>;
}
