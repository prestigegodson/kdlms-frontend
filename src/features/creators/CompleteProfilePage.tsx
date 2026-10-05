import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { updateMyCreatorProfile } from "@/api/creators";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { CreatorProfileFields } from "@/features/creators/components/CreatorProfileFields";
import { emptyCreatorProfile } from "@/features/creators/creatorProfileDefaults";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

type Status = { kind: "form" } | { kind: "submitting" } | { kind: "error"; message: string };

/**
 * The forced "complete your business profile" step for a creator who signed up with Google
 * (creators.md §4) - RequireRole sends any `profileIncomplete` creator here, and the server refuses
 * every other write (403 profile-incomplete) until this form is saved. Saving creates the profile
 * (PUT /api/v1/creator/profile), then refreshes the session so the new access token drops the
 * profileIncomplete claim.
 * <p>
 * Not wrapped in RequireRole (that would loop), so it guards itself - the SetInitialPasswordPage
 * precedent: anonymous -> /login, a creator with a profile already -> their portal.
 */
export function CompleteProfilePage() {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(() => ({
    ...emptyCreatorProfile(),
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
  }));
  const [status, setStatus] = useState<Status>({ kind: "form" });

  if (!hydrated) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "CREATOR" || !user.profileIncomplete) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "submitting" });
    try {
      await updateMyCreatorProfile(profile);
      await refreshSession();
      navigate("/creator", { replace: true });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof ApiError ? error.message : "We couldn't save your profile. Please try again.",
      });
    }
  }

  function handleSignOut() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <AuthLayout
      title="Complete your business profile"
      description="Tell us about your business before you start creating classes."
    >
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {status.kind === "error" && <Alert variant="error">{status.message}</Alert>}
        <CreatorProfileFields value={profile} onChange={setProfile} idPrefix="complete" />
        <Button type="submit" loading={status.kind === "submitting"} className="w-full">
          {status.kind === "submitting" ? "Saving…" : "Continue"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={status.kind === "submitting"}
          onClick={handleSignOut}
        >
          Sign out
        </Button>
      </form>
    </AuthLayout>
  );
}
