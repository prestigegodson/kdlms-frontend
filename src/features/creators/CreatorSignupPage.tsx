import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { registerCreator } from "@/api/creators";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { GoogleSignInButton, OrDivider } from "@/features/auth/GoogleSignInButton";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { CreatorProfileFields } from "@/features/creators/components/CreatorProfileFields";
import { emptyCreatorProfile } from "@/features/creators/creatorProfileDefaults";
import { useAuthStore } from "@/stores/authStore";

/**
 * Public education-creator sign-up (creators.md Phase C1). On success the creator is signed in
 * straight away and lands in their portal, where a banner asks them to verify their email -
 * every write is refused server-side until they do. Signing up with Google instead (Phase C2) skips
 * the form entirely: the account is created verified, and RequireRole then forces the creator
 * through /creator/complete-profile for their business details. While the backend serves a
 * Turnstile site key the form also needs a passed CAPTCHA; a token is single-use, so the widget is
 * remounted for a fresh one after every failed submit.
 */
export function CreatorSignupPage() {
  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState(emptyCreatorProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await registerCreator({ email, password, profile, captchaToken });
      // Creators always sign in on the platform's own host - never a school subdomain.
      await login(email, password, null);
      navigate("/creator", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't create your account. Please try again.");
      setSubmitting(false);
      setCaptchaToken(null);
      setCaptchaKey((key) => key + 1);
    }
  }

  async function handleGoogleCredential(idToken: string) {
    setSubmitting(true);
    setError(null);
    try {
      const user = await loginWithGoogle(idToken, "CREATOR_SIGNUP", null);
      // An existing creator is simply signed in; a new one is sent on to complete their profile.
      navigate(user.profileIncomplete ? "/creator/complete-profile" : "/creator", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't sign you up with Google. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Teach on KDLMS" description="Create your creator account to run online classes.">
      <div className="mt-6">
        <GoogleSignInButton mode="signup" onCredential={handleGoogleCredential} after={<OrDivider />} />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert variant="error">{error}</Alert>}
        <FormField label="Email" htmlFor="signup-email">
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="signup-password">
          <PasswordInput
            id="signup-password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <CreatorProfileFields value={profile} onChange={setProfile} idPrefix="signup" />
        <TurnstileWidget key={captchaKey} onToken={setCaptchaToken} onAvailable={setCaptchaRequired} />
        <Button
          type="submit"
          loading={submitting}
          disabled={captchaRequired && !captchaToken}
          className="w-full"
        >
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-brand-500 hover:text-brand-600">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
