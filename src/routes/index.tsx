import { createBrowserRouter, Navigate, useParams, type RouteObject } from "react-router";
import { NotFoundPage } from "@/components/ui/NotFoundPage";
import { RouteErrorBoundary } from "@/components/ui/RouteErrorBoundary";
import { ClassDetailPage } from "@/features/academics/ClassDetailPage";
import { ClassesPage } from "@/features/academics/ClassesPage";
import { LevelsPage } from "@/features/academics/LevelsPage";
import { SessionsPage } from "@/features/academics/SessionsPage";
import { SubjectsPage } from "@/features/academics/SubjectsPage";
import { AdministratorsPage } from "@/features/administrators/AdministratorsPage";
import { AdminAiSettingsPage } from "@/features/ai/AdminAiSettingsPage";
import { AssessmentsPage } from "@/features/assessments/AssessmentsPage";
import { GradingSystemEditorPage } from "@/features/assessments/GradingSystemEditorPage";
import { GradingSystemsPage } from "@/features/assessments/GradingSystemsPage";
import { AttendancePage } from "@/features/attendance/AttendancePage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { SetInitialPasswordPage } from "@/features/auth/SetInitialPasswordPage";
import { VerifyEmailPage } from "@/features/auth/VerifyEmailPage";
import { BillingCallbackPage } from "@/features/subscriptionBilling/BillingCallbackPage";
import { BillingHomeRedirect } from "@/features/subscriptionBilling/BillingHomeRedirect";
import { PaymentTransactionsPage } from "@/features/subscriptionBilling/PaymentTransactionsPage";
import { PlanBillingPage } from "@/features/subscriptionBilling/PlanBillingPage";
import { BranchesPage } from "@/features/branches/BranchesPage";
import { MessagesPage } from "@/features/communication/MessagesPage";
import { LandingPage } from "@/features/connectivity/LandingPage";
import { CreatorDetailPage } from "@/features/creators/admin/CreatorDetailPage";
import { CreatorsPage } from "@/features/creators/admin/CreatorsPage";
import { CreatorDashboardPage } from "@/features/creators/CreatorDashboardPage";
import { CreatorProfilePage } from "@/features/creators/CreatorProfilePage";
import { CreatorSignupPage } from "@/features/creators/CreatorSignupPage";
import { CompleteProfilePage } from "@/features/creators/CompleteProfilePage";
import { SessionsCalendarPage } from "@/features/virtualclass/pages/SessionsCalendarPage";
import { LearnersPage } from "@/features/virtualclass/pages/LearnersPage";
import { InviteAcceptPage } from "@/features/invites/InviteAcceptPage";
import { MyClassesPage } from "@/features/learner/MyClassesPage";
import { CreatorMessagesPage } from "@/features/classMessages/pages/CreatorMessagesPage";
import { MemberMessagesPage } from "@/features/classMessages/pages/MemberMessagesPage";
import { CreatorLessonNoteEditorPage } from "@/features/lessonNotes/creator/CreatorLessonNoteEditorPage";
import { CreatorLessonNotesPage } from "@/features/lessonNotes/creator/CreatorLessonNotesPage";
import { ClassLessonNotesReaderPage } from "@/features/lessonNotes/reader/ClassLessonNotesReaderPage";
import { ClassResourceDetailPage } from "@/features/learning/classMember/ClassResourceDetailPage";
import { ClassResourcesPage } from "@/features/learning/classMember/ClassResourcesPage";
import { CreatorResourcePreviewPage } from "@/features/learning/creator/CreatorResourcePreviewPage";
import { CreatorResourcesPage } from "@/features/learning/creator/CreatorResourcesPage";
import { ClassQuizzesPage } from "@/features/takeHomeQuizzes/classMember/ClassQuizzesPage";
import { LearnerClassQuizPage } from "@/features/takeHomeQuizzes/classMember/LearnerClassQuizPage";
import { CreatorQuizEditorPage } from "@/features/takeHomeQuizzes/creator/CreatorQuizEditorPage";
import { CreatorQuizResultsPage } from "@/features/takeHomeQuizzes/creator/CreatorQuizResultsPage";
import { CreatorQuizzesPage } from "@/features/takeHomeQuizzes/creator/CreatorQuizzesPage";
import { OnlineClassesPage } from "@/features/guardian/OnlineClassesPage";
import { VirtualClassDetailPage } from "@/features/virtualclass/pages/VirtualClassDetailPage";
import { VirtualClassesPage } from "@/features/virtualclass/pages/VirtualClassesPage";
import { AdminDashboardPage } from "@/features/dashboard/AdminDashboardPage";
import { SchoolDashboardPage } from "@/features/dashboard/SchoolDashboardPage";
import { NotificationSettingsPage } from "@/features/guardian/NotificationSettingsPage";
import { WardAttendanceLayout } from "@/features/guardian/WardAttendanceLayout";
import { WardBillsPage } from "@/features/guardian/WardBillsPage";
import { WardPaymentsPage } from "@/features/guardian/WardPaymentsPage";
import { WardAttendancePage } from "@/features/guardian/WardAttendancePage";
import { WardAttendanceSessionsPage } from "@/features/guardian/WardAttendanceSessionsPage";
import { WardAttendanceSessionTermsPage } from "@/features/guardian/WardAttendanceSessionTermsPage";
import { WardMessagesPage } from "@/features/guardian/WardMessagesPage";
import { WardResultsLayout } from "@/features/guardian/WardResultsLayout";
import { WardResultsPage } from "@/features/guardian/WardResultsPage";
import { WardSessionsPage } from "@/features/guardian/WardSessionsPage";
import { WardSessionTermsPage } from "@/features/guardian/WardSessionTermsPage";
import { WardTermAttendancePage } from "@/features/guardian/WardTermAttendancePage";
import { WardTakeHomeQuizzesPage } from "@/features/guardian/WardTakeHomeQuizzesPage";
import { WardTermResultPage } from "@/features/guardian/WardTermResultPage";
import { WardTimetablePage } from "@/features/guardian/WardTimetablePage";
import { WardsPage } from "@/features/guardian/WardsPage";
import { GuardiansPage } from "@/features/guardians/GuardiansPage";
import { LearningResourcePreviewPage } from "@/features/learning/LearningResourcePreviewPage";
import { LearningResourcesPage } from "@/features/learning/LearningResourcesPage";
import { LessonNotesPage } from "@/features/lessonNotes/LessonNotesPage";
import { HowToGuidesPage } from "@/features/onboarding/pages/HowToGuidesPage";
import { CouponsPage } from "@/features/coupons/CouponsPage";
import { PackagesPage } from "@/features/packages/PackagesPage";
import { ReportSettingsPage } from "@/features/reporting/ReportSettingsPage";
import { ReportsPage } from "@/features/reporting/ReportsPage";
import { ResultTemplatesPage } from "@/features/reporting/ResultTemplatesPage";
import { SchoolProfilePage } from "@/features/school/SchoolProfilePage";
import { SchoolSettingsPage } from "@/features/school/SchoolSettingsPage";
import { SchoolDetailPage } from "@/features/schools/SchoolDetailPage";
import { SchoolsPage } from "@/features/schools/SchoolsPage";
import { StudentDashboardPage } from "@/features/student/StudentDashboardPage";
import { StudentQuizPage } from "@/features/student/StudentQuizPage";
import { StudentQuizzesPage } from "@/features/student/StudentQuizzesPage";
import { StudentResourceDetailPage } from "@/features/student/StudentResourceDetailPage";
import { StudentResourcesPage } from "@/features/student/StudentResourcesPage";
import { StudentResultsPage } from "@/features/student/StudentResultsPage";
import { StudentTermResultPage } from "@/features/student/StudentTermResultPage";
import { StudentTimetablePage } from "@/features/student/StudentTimetablePage";
import { PromotionPage } from "@/features/students/PromotionPage";
import { StudentDetailPage } from "@/features/students/StudentDetailPage";
import { StudentResultHistoryPage } from "@/features/students/StudentResultHistoryPage";
import { StudentsPage } from "@/features/students/StudentsPage";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";
import { AdminSupportContactPage } from "@/features/support/AdminSupportContactPage";
import { SupportPage } from "@/features/support/SupportPage";
import { TakeHomeQuizzesPage } from "@/features/takeHomeQuizzes/TakeHomeQuizzesPage";
import { TeachersPage } from "@/features/teachers/TeachersPage";
import { PeriodGridPage } from "@/features/timetable/PeriodGridPage";
import { TimetablePage } from "@/features/timetable/TimetablePage";
import { GuardianLayout } from "@/layouts/GuardianLayout";
import { RootLayout } from "@/layouts/RootLayout";
import { SchoolLayout } from "@/layouts/SchoolLayout";
import { StudentLayout } from "@/layouts/StudentLayout";
import { CreatorLayout } from "@/layouts/CreatorLayout";
import { LearnerLayout } from "@/layouts/LearnerLayout";
import { SystemAdminLayout } from "@/layouts/SystemAdminLayout";
import { BillingRoute } from "@/routes/BillingRoute";
import { HomeRedirect } from "@/routes/HomeRedirect";
import { InventoryRoute } from "@/routes/InventoryRoute";
import { LessonNoteEditorRoute } from "@/routes/LessonNoteEditorRoute";
import { RequireRole } from "@/routes/RequireRole";
import { TakeHomeQuizEditorRoute } from "@/routes/TakeHomeQuizEditorRoute";
import { TakeHomeQuizResultsRoute } from "@/routes/TakeHomeQuizResultsRoute";
import { LiveSessionRoute } from "@/routes/LiveSessionRoute";
import { TakeHomeQuizRoute } from "@/routes/TakeHomeQuizRoute";
import { TemplateDesignerRoute } from "@/routes/TemplateDesignerRoute";
import { WardLessonNotesRoute } from "@/routes/WardLessonNotesRoute";

/**
 * Exported as a plain array (rather than only building `router` below) so
 * tests can feed it into `createMemoryRouter` - the shared
 * `createBrowserRouter` instance can't start at an arbitrary path and
 * leaks state between test runs.
 */
/** Old class-detail URL (`academics/classes/:classId`, pre-rename) redirects to the new classroom-detail URL. */
function RedirectOldClassDetailUrl() {
  const { classId } = useParams();
  return <Navigate to={`/school/academics/classrooms/${classId}`} replace />;
}

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomeRedirect /> },
      { path: "status", element: <LandingPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "set-password", element: <SetInitialPasswordPage /> },
      { path: "creators/signup", element: <CreatorSignupPage /> },
      { path: "creator/complete-profile", element: <CompleteProfilePage /> },
      { path: "verify-email", element: <VerifyEmailPage /> },
      { path: "invite/:token", element: <InviteAcceptPage /> },
      { path: "take-home-quiz", element: <TakeHomeQuizRoute /> },
      {
        // Paystack sends the browser back here after checkout (creators.md §6.1, Phase C8).
        path: "billing/callback",
        element: (
          <RequireRole roles={["CREATOR", "SCHOOL_ADMIN"]}>
            <BillingCallbackPage />
          </RequireRole>
        ),
      },
      {
        path: "billing",
        element: (
          <RequireRole roles={["CREATOR", "SCHOOL_ADMIN"]}>
            <BillingHomeRedirect />
          </RequireRole>
        ),
      },
      {
        path: "live/:occurrenceId",
        element: (
          <RequireRole roles={["CREATOR", "LEARNER", "GUARDIAN"]}>
            <LiveSessionRoute />
          </RequireRole>
        ),
      },
      {
        path: "admin",
        element: (
          <RequireRole roles={["SYSTEM_ADMIN"]}>
            <SystemAdminLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: "schools", element: <SchoolsPage /> },
          { path: "schools/:schoolId", element: <SchoolDetailPage /> },
          { path: "creators", element: <CreatorsPage /> },
          { path: "creators/:schoolId", element: <CreatorDetailPage /> },
          { path: "packages", element: <PackagesPage /> },
          { path: "templates", element: <ResultTemplatesPage /> },
          { path: "templates/:templateId", element: <TemplateDesignerRoute /> },
          { path: "support", element: <AdminSupportContactPage /> },
          { path: "ai", element: <AdminAiSettingsPage /> },
          { path: "payments", element: <PaymentTransactionsPage /> },
          { path: "coupons", element: <CouponsPage /> },
          { path: "help", element: <HowToGuidesPage /> },
        ],
      },
      {
        path: "school",
        element: (
          <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER", "INVENTORY_MANAGER"]}>
            <SchoolLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <SchoolDashboardPage /> },
          { path: "help", element: <HowToGuidesPage /> },
          {
            path: "branches",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <BranchesPage />
              </RequireRole>
            ),
          },
          {
            path: "administrators",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <AdministratorsPage />
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
            path: "settings",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <SchoolSettingsPage />
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
            path: "support",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <SupportPage />
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
          {
            path: "academics/classes",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <LevelsPage />
              </RequireRole>
            ),
          },
          { path: "academics/levels", element: <Navigate to="/school/academics/classes" replace /> },
          { path: "academics/subjects", element: <SubjectsPage /> },
          { path: "academics/classrooms", element: <ClassesPage /> },
          { path: "academics/classrooms/:classId", element: <ClassDetailPage /> },
          { path: "academics/classes/:classId", element: <RedirectOldClassDetailUrl /> },
          {
            path: "academics/teachers",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]} allowLevelHead>
                <TeachersPage />
              </RequireRole>
            ),
          },
          {
            path: "timetable/periods",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <PeriodGridPage />
              </RequireRole>
            ),
          },
          { path: "timetable", element: <TimetablePage /> },
          { path: "lesson-notes", element: <LessonNotesPage /> },
          { path: "lesson-notes/:noteId", element: <LessonNoteEditorRoute /> },
          { path: "take-home-quizzes", element: <TakeHomeQuizzesPage /> },
          { path: "take-home-quizzes/:quizId", element: <TakeHomeQuizEditorRoute /> },
          { path: "take-home-quizzes/:quizId/results", element: <TakeHomeQuizResultsRoute /> },
          { path: "learning-resources", element: <LearningResourcesPage /> },
          { path: "learning-resources/:resourceId", element: <LearningResourcePreviewPage /> },
          {
            path: "students",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN", "TEACHER", "INVENTORY_MANAGER"]}>
                <StudentsPage />
              </RequireRole>
            ),
          },
          {
            path: "students/promotion",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]} allowLevelHead>
                <PromotionPage />
              </RequireRole>
            ),
          },
          {
            path: "students/:studentId",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]} allowLevelHead>
                <StudentDetailPage />
              </RequireRole>
            ),
          },
          {
            path: "students/:studentId/results/:sessionId",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]} allowLevelHead>
                <StudentResultHistoryPage />
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
          { path: "assessments", element: <AssessmentsPage /> },
          {
            path: "assessments/grading",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <GradingSystemsPage />
              </RequireRole>
            ),
          },
          {
            path: "assessments/grading/:levelId",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN"]}>
                <GradingSystemEditorPage />
              </RequireRole>
            ),
          },
          { path: "attendance", element: <AttendancePage /> },
          { path: "messages", element: <MessagesPage /> },
          { path: "reports", element: <ReportsPage /> },
          {
            path: "reports/settings",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <ReportSettingsPage />
              </RequireRole>
            ),
          },
          {
            path: "billing",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN"]}>
                <BillingRoute />
              </RequireRole>
            ),
          },
          {
            path: "inventory",
            element: (
              <RequireRole roles={["SCHOOL_ADMIN", "BRANCH_ADMIN", "INVENTORY_MANAGER"]}>
                <InventoryRoute />
              </RequireRole>
            ),
          },
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
          { index: true, element: <WardsPage /> },
          { path: "help", element: <HowToGuidesPage /> },
          {
            path: "results",
            children: [
              { index: true, element: <WardResultsPage /> },
              {
                path: ":studentId",
                element: <WardResultsLayout />,
                children: [
                  { index: true, element: <WardSessionsPage /> },
                  { path: ":sessionId", element: <WardSessionTermsPage /> },
                  { path: ":sessionId/:termId", element: <WardTermResultPage /> },
                ],
              },
            ],
          },
          {
            path: "attendance",
            children: [
              { index: true, element: <WardAttendancePage /> },
              {
                path: ":studentId",
                element: <WardAttendanceLayout />,
                children: [
                  { index: true, element: <WardAttendanceSessionsPage /> },
                  { path: ":sessionId", element: <WardAttendanceSessionTermsPage /> },
                  { path: ":sessionId/:termId", element: <WardTermAttendancePage /> },
                ],
              },
            ],
          },
          { path: "messages", element: <WardMessagesPage /> },
          { path: "timetable", element: <WardTimetablePage /> },
          { path: "lesson-notes", element: <WardLessonNotesRoute /> },
          { path: "take-home-quizzes", element: <WardTakeHomeQuizzesPage /> },
          { path: "bills", element: <WardBillsPage /> },
          { path: "payments", element: <WardPaymentsPage /> },
          { path: "fees", element: <Navigate to="/guardian/bills" replace /> },
          { path: "settings", element: <NotificationSettingsPage /> },
          { path: "online-classes", element: <OnlineClassesPage /> },
          { path: "class-messages", element: <MemberMessagesPage audience="GUARDIAN" /> },
          { path: "class-lesson-notes", element: <ClassLessonNotesReaderPage audience="GUARDIAN" /> },
          { path: "class-quizzes", element: <ClassQuizzesPage audience="GUARDIAN" /> },
          { path: "class-resources", element: <ClassResourcesPage audience="GUARDIAN" /> },
          {
            path: "class-resources/:learnerId/:classId/:resourceId",
            element: <ClassResourceDetailPage audience="GUARDIAN" />,
          },
        ],
      },
      {
        path: "student",
        element: (
          <RequireRole roles={["STUDENT"]}>
            <StudentLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <StudentDashboardPage /> },
          { path: "help", element: <HowToGuidesPage /> },
          { path: "results", element: <StudentResultsPage /> },
          { path: "results/:sessionId/:termId", element: <StudentTermResultPage /> },
          { path: "resources", element: <StudentResourcesPage /> },
          { path: "resources/:resourceId", element: <StudentResourceDetailPage /> },
          { path: "quizzes", element: <StudentQuizzesPage /> },
          { path: "quizzes/:quizId", element: <StudentQuizPage /> },
          { path: "timetable", element: <StudentTimetablePage /> },
        ],
      },
      {
        path: "creator",
        element: (
          <RequireRole roles={["CREATOR"]}>
            <CreatorLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <CreatorDashboardPage /> },
          { path: "profile", element: <CreatorProfilePage /> },
          { path: "classes", element: <VirtualClassesPage /> },
          { path: "classes/:classId", element: <VirtualClassDetailPage /> },
          { path: "sessions", element: <SessionsCalendarPage /> },
          { path: "learners", element: <LearnersPage /> },
          { path: "messages", element: <CreatorMessagesPage /> },
          { path: "lesson-notes", element: <CreatorLessonNotesPage /> },
          { path: "lesson-notes/:classId/:noteId", element: <CreatorLessonNoteEditorPage /> },
          { path: "quizzes", element: <CreatorQuizzesPage /> },
          { path: "quizzes/:classId/:quizId", element: <CreatorQuizEditorPage /> },
          { path: "quizzes/:classId/:quizId/results", element: <CreatorQuizResultsPage /> },
          { path: "resources", element: <CreatorResourcesPage /> },
          { path: "resources/:classId/:resourceId", element: <CreatorResourcePreviewPage /> },
          { path: "billing", element: <PlanBillingPage /> },
        ],
      },
      {
        path: "learner",
        element: (
          <RequireRole roles={["LEARNER"]}>
            <LearnerLayout />
          </RequireRole>
        ),
        children: [
          { index: true, element: <MyClassesPage /> },
          { path: "messages", element: <MemberMessagesPage audience="LEARNER" /> },
          { path: "lesson-notes", element: <ClassLessonNotesReaderPage audience="LEARNER" /> },
          { path: "quizzes", element: <ClassQuizzesPage audience="LEARNER" /> },
          { path: "quizzes/:classId/:quizId", element: <LearnerClassQuizPage /> },
          { path: "resources", element: <ClassResourcesPage audience="LEARNER" /> },
          { path: "resources/:classId/:resourceId", element: <ClassResourceDetailPage audience="LEARNER" /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
