import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { homePathForRole } from "@/routes/roleHome";
import { useAuthStore } from "@/stores/authStore";

interface LocationState {
  from?: { pathname: string; search: string };
}

/** Real login form: submits to identity's login endpoint, then redirects to where the user was headed (or their role's home). */
export function LoginPage() {
  const login = useAuthStore((state) => state.login);
  const status = useAuthStore((state) => state.status);
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as LocationState | null)?.from;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    try {
      const user = await login(email, password);
      const destination = from ? `${from.pathname}${from.search}` : homePathForRole(user.role);
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "Unable to sign in. Please try again.",
      );
    }
  }

  return (
    <AuthLayout title="Sign in to KDLMS" description="Use the credentials your school or system admin gave you.">
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {formError && <Alert variant="error">{formError}</Alert>}
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
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
    </AuthLayout>
  );
}
