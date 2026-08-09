import { ConnectivityPanel } from "@/features/connectivity/ConnectivityPanel";

/** Phase 0 landing page: no real dashboard yet, just proof the app and API are wired together. */
export function LandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="font-display text-2xl font-medium text-slate-900">KDLMS</h1>
      <p className="mt-2 text-slate-600">School Management SaaS - Phase 0 scaffold.</p>
      <div className="mt-8">
        <ConnectivityPanel />
      </div>
    </div>
  );
}
