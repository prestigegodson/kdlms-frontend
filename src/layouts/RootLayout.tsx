import { Outlet } from "react-router";

/** Top-level shell shared by every route; portal-specific chrome lives in the layouts below. */
export function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
}
