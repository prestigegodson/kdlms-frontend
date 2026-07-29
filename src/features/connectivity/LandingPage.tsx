import { ConnectivityPanel } from "@/features/connectivity/ConnectivityPanel";

/** Phase 0 landing page: no real dashboard yet, just proof the app and API are wired together. */
export function LandingPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900">KDLMS</h1>
      <p className="mt-2 text-gray-600">School Management SaaS - Phase 0 scaffold.</p>
      <div className="mt-8">
        <ConnectivityPanel />
      </div>
    </div>
  );
}
