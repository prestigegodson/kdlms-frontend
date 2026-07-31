import { createBrowserRouter, type RouteObject } from "react-router";
import { NotFoundPage } from "@/components/ui/NotFoundPage";
import { PlaceholderPage } from "@/components/ui/PlaceholderPage";
import { ClassDetailPage } from "@/features/academics/ClassDetailPage";
import { ClassesPage } from "@/features/academics/ClassesPage";
import { SessionsPage } from "@/features/academics/SessionsPage";
import { SubjectsPage } from "@/features/academics/SubjectsPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { BranchesPage } from "@/features/branches/BranchesPage";
import { LandingPage } from "@/features/connectivity/LandingPage";
import { GuardiansPage } from "@/features/guardians/GuardiansPage";
import { PackagesPage } from "@/features/packages/PackagesPage";
import { SchoolProfilePage } from "@/features/school/SchoolProfilePage";
import { SchoolDetailPage } from "@/features/schools/SchoolDetailPage";
import { SchoolsPage } from "@/features/schools/SchoolsPage";
import { PromotionPage } from "@/features/students/PromotionPage";
import { StudentDetailPage } from "@/features/students/StudentDetailPage";
import { StudentsPage } from "@/features/students/StudentsPage";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";
import { TeachersPage } from "@/features/teachers/TeachersPage";
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
          {
            path: "branches",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <BranchesPage />
              </RequireRole>
            ),
          },
          {
            path: "profile",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <SchoolProfilePage />
              </RequireRole>
            ),
          },
          {
            path: "subscription",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <SubscriptionPage />
              </RequireRole>
            ),
          },
          {
            path: "academics/sessions",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <SessionsPage />
              </RequireRole>
            ),
          },
          { path: "academics/subjects", element: <SubjectsPage /> },
          { path: "academics/classes", element: <ClassesPage /> },
          { path: "academics/classes/:classId", element: <ClassDetailPage /> },
          {
            path: "academics/teachers",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <TeachersPage />
              </RequireRole>
            ),
          },
          {
            path: "students",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER"]}>
                <StudentsPage />
              </RequireRole>
            ),
          },
          {
            path: "students/promotion",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <PromotionPage />
              </RequireRole>
            ),
          },
          {
            path: "students/:studentId",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <StudentDetailPage />
              </RequireRole>
            ),
          },
          {
            path: "guardians",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <GuardiansPage />
              </RequireRole>
            ),
          },
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
