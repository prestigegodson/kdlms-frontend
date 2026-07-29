import { Navigate } from "react-router";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

/** The `/` route: sends a signed-in user to their role's home, everyone else to /login. */
export function HomeRedirect() {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  if (!hydrated) {
    return null;
  }

  return <Navigate to={user ? homePathForRole(user.role) : "/login"} replace />;
}
