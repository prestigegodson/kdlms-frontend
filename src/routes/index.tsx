import { createBrowserRouter, type RouteObject } from "react-router";
import { NotFoundPage } from "@/components/ui/NotFoundPage";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { BranchesPage } from "@/features/branches/BranchesPage";
import { LandingPage } from "@/features/connectivity/LandingPage";
import { PackagesPage } from "@/features/packages/PackagesPage";
import { SchoolProfilePage } from "@/features/school/SchoolProfilePage";
import { SchoolDetailPage } from "@/features/schools/SchoolDetailPage";
import { SchoolsPage } from "@/features/schools/SchoolsPage";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";
import { GuardianLayout } from "@/layouts/GuardianLayout";
import { RootLayout } from "@/layouts/RootLayout";
import { SchoolLayout } from "@/layouts/SchoolLayout";
import { SystemAdminLayout } from "@/layouts/SystemAdminLayout";
import { HomeRedirect } from "@/routes/HomeRedirect";
import { RequireRole } from "@/routes/RequireRole";

/**
 * Exported as a plain array (rather than only building `router` below) so
 * tests can feed it into `createMemoryRouter` - the shared
 * `createBrowserRouter` instance can't start at an arbitrary path and
 * leaks state between test runs.
 */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "status", element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      {
        path: "admin",
        element: (
          <RequireRole roles={["SYSTEM_ADMIN"]}>
            <SystemAdminLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <SchoolsPage /> },
          { path: "schools", element: <SchoolsPage /> },
          { path: "schools/:schoolId", element: <SchoolDetailPage /> },
          { path: "packages", element: <PackagesPage /> },
          { path: "templates", element: <PlaceholderPage title="Result Templates" /> },
        ],
      },
      {
        path: "school",
        element: (
          <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER"]}>
            <SchoolLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <PlaceholderPage title="Dashboard" /> },
          { path: "branches", element: <BranchesPage /> },
          { path: "profile", element: <SchoolProfilePage /> },
          { path: "subscription", element: <SubscriptionPage /> },
          { path: "academics", element: <PlaceholderPage title="Academics" /> },
          { path: "students", element: <PlaceholderPage title="Students" /> },
          { path: "assessments", element: <PlaceholderPage title="Assessments" /> },
          { path: "attendance", element: <PlaceholderPage title="Attendance" /> },
        ],
      },
      {
        path: "guardian",
        element: (
          <RequireRole roles={["GUARDIAN"]}>
            <GuardianLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <PlaceholderPage title="My Wards" /> },
          { path: "results", element: <PlaceholderPage title="Results" /> },
          { path: "attendance", element: <PlaceholderPage title="Attendance" /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
