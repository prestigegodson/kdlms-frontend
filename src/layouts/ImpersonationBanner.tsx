import { UserCog } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { formatInstant } from "@/utils/date";

/**
 * "You're signed in as someone else" strip, shown on every page of the
 * school-portal session while a SYSTEM_ADMIN is impersonating a
 * SCHOOL_ADMIN (see authStore's `startImpersonation`/`impersonation`
 * state). Mounted once, above the sidebar/header split, by PortalShell -
 * deliberately not `sticky` like the header below it (coordinating two
 * stacked sticky offsets isn't worth it for a bar whose job is "always
 * present on this page", not "always in the viewport while scrolling").
 * <p>
 * Renders nothing when not impersonating - a plain school-admin/branch-
 * admin/teacher session never sets `impersonation`, so this is a no-op for
 * every ordinary sign-in.
 */
export function ImpersonationBanner() {
  const impersonation = useAuthStore((state) => state.impersonation);
  const user = useAuthStore((state) => state.user);
  const stopImpersonation = useAuthStore((state) => state.stopImpersonation);
  const navigate = useNavigate();

  if (!impersonation || !user) {
    return null;
  }

  // The school currently being impersonated - the stashed (system-admin)
  // session has none of its own, see AuthenticatedUser's Javadoc. Captured
  // here (rather than read inside handleStop) so TS's null-narrowing above
  // applies - a `function` declaration doesn't inherit it.
  const schoolId = user.schoolId;

  async function handleStop() {
    await stopImpersonation();
    navigate(schoolId ? `/admin/schools/${schoolId}` : "/admin", { replace: true });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-amber-500 px-4 py-1.5 text-amber-950">
      <UserCog className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate text-xs font-medium sm:text-sm">
        Viewing as{" "}
        <strong>
          {user.firstName} {user.lastName}
        </strong>
        {impersonation.schoolName ? ` at ${impersonation.schoolName}` : ""} - ends{" "}
        {formatInstant(impersonation.expiresAt)}
      </span>
      <Button type="button" variant="secondary" size="sm" onClick={handleStop} className="shrink-0 py-0.5">
        Stop impersonating
      </Button>
    </div>
  );
}
