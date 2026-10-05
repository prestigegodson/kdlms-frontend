import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { GOOGLE_ACCOUNT_NOT_FOUND } from "@/api/auth";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { GoogleSignInButton, OrDivider } from "@/features/auth/GoogleSignInButton";
import { homePathForRole } from "@/routes/roleHome";
import { type AuthenticatedUser, useAuthStore } from "@/stores/authStore";
import { usePublicBrandingStore } from "@/stores/publicBrandingStore";
import { platformLoginUrl, resolveSchoolSubdomain } from "@/utils/host";

const SCHOOL_HOST_MISMATCH_TYPE = "https://kdlms.com/problems/school-host-mismatch";

interface LocationState {
  from?: { pathname: string; search: string };
}

/** Real login form: submits to identity's login endpoint, then redirects to where the user was headed (or their role's home). */
export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const status = useAuthStore((state) => state.status);
  const schoolName = usePublicBrandingStore((state) => state.schoolName);
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [hostMismatch, setHostMismatch] = useState(false);
  const [googleAccountMissing, setGoogleAccountMissing] = useState(false);

  const from = (location.state as LocationState | null)?.from;
  const subdomain = resolveSchoolSubdomain();
  const brandName = schoolName ?? "KDLMS";

  async function signIn(attempt: () => Promise<AuthenticatedUser>) {
    setFormError(null);
    setHostMismatch(false);
    setGoogleAccountMissing(false);
    try {
      const user = await attempt();
      const destination = from ? `${from.pathname}${from.search}` : homePathForRole(user.role);
      navigate(destination, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
        setHostMismatch(error.problem?.type === SCHOOL_HOST_MISMATCH_TYPE);
        setGoogleAccountMissing(error.problem?.type === GOOGLE_ACCOUNT_NOT_FOUND);
      } else {
        setFormError("Unable to sign in. Please try again.");
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void signIn(() => login(identifier, password, subdomain));
  }

  function handleGoogleCredential(idToken: string) {
    void signIn(() => loginWithGoogle(idToken, "LOGIN", subdomain));
  }

  return (
    <AuthLayout title={`Sign in to ${brandName}`} description="Use the credentials your school or system admin gave you.">
      <div className="mt-6">
        <GoogleSignInButton mode="signin" onCredential={handleGoogleCredential} after={<OrDivider />} />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {formError && (
          <Alert variant="error">
            <span>{formError}</span>
            {hostMismatch && (
              <>
                {" "}
                <a href={platformLoginUrl()} className="font-medium underline">
                  Sign in at the main site instead
                </a>
                .
              </>
            )}
            {googleAccountMissing && !subdomain && (
              <>
                {" "}
                <Link to="/creators/signup" className="font-medium underline">
                  Create a creator account
                </Link>
                .
              </>
            )}
          </Alert>
        )}
        <FormField label="Email or student ID" htmlFor="identifier">
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            enterKeyHint="next"
            required
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            enterKeyHint="go"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <Button type="submit" loading={status === "authenticating"} className="w-full">
          {status === "authenticating" ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link to="/forgot-password" className="font-medium text-brand-500 hover:text-brand-600">
          Forgot your password?
        </Link>
      </p>
      {/* Creators sign up and sign in on the platform's own host only - never a school's subdomain. */}
      {!subdomain && (
        <p className="mt-2 text-center text-sm text-slate-500">
          Teach online?{" "}
          <Link to="/creators/signup" className="font-medium text-brand-500 hover:text-brand-600">
            Sign up as a creator
          </Link>
        </p>
      )}
    </AuthLayout>
  );
}
