import { Link } from "react-router";

/** Shown for unmatched routes, and as the router's errorElement fallback for uncaught render errors. */
export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Page not found</h1>
      <p className="text-sm text-gray-500">
        The page you're looking for doesn't exist or you don't have access.
      </p>
      <Link to="/" className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700">
        Back to home
      </Link>
    </div>
  );
}
