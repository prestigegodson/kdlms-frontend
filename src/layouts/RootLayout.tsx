import { Outlet } from "react-router";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * Top-level shell shared by every route; portal-specific chrome lives in
 * the layouts below. Also the one app-wide mount point for
 * `useDocumentTitle` (Phase 13's branded-subdomain tab title), since there
 * is no `App.tsx`.
 */
export function RootLayout() {
  useDocumentTitle();
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
}
