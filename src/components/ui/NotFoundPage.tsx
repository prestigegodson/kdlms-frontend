import { Compass } from "lucide-react";
import { Link } from "react-router";

/** Shown for unmatched routes, and as the router's errorElement fallback for uncaught render errors. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="font-display text-2xl font-medium text-slate-900">Page not found</h1>
      <p className="text-sm text-slate-500">
        The page you're looking for doesn't exist or you don't have access.
      </p>
      <Link to="/" className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600">
        Back to home
      </Link>
    </div>
  );
}
