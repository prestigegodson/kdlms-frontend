import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentLayout } from "@/layouts/StudentLayout";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import type { AuthenticatedUser } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";
import { resetInstallPromptStore } from "@/stores/installPromptStore";
import { resetNavGroupsStore } from "@/stores/navGroupsStore";
import { resetSchoolBrandingStore, useSchoolBrandingStore } from "@/stores/schoolBrandingStore";
import { resetStudentStore, useStudentStore } from "@/stores/studentStore";

const STUDENT: AuthenticatedUser = {
  id: "student-1",
  email: "grace-kdl24001",
  firstName: "Grace",
  lastName: "Ward",
  role: "STUDENT",
  schoolId: "school-1",
  branchId: "branch-1",
};

/**
 * Phase 35J: `StudentLayout`'s own test, named in `student-portal-plan.md`'s Verification
 * section (`npx vitest run src/layouts/StudentLayout.test.tsx`) but missing from 35J.12's list.
 * The `NAV_ITEMS` constant this layout builds isn't exported, so this exercises the real
 * component - the `routes/index.test.tsx` STUDENT block's rendering shape, narrowed to the
 * shell's own nav/gating concerns rather than routing.
 */
function renderStudentLayout(pathname = "/student") {
  const router = createMemoryRouter([{ path: "*", element: <StudentLayout /> }], {
    initialEntries: [pathname],
  });
  render(<RouterProvider router={router} />);
}

function tabBar() {
  return screen.getByRole("navigation", { name: "Primary" });
}

describe("StudentLayout", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: STUDENT, accessToken: "t", refreshToken: "r" });
    resetStudentStore();
    useStudentStore.setState({
      status: "loaded",
      me: {
        studentId: "student-1",
        fullName: "Grace Ward",
        admissionNumber: "KDL/24/001",
        gender: "FEMALE",
        hasPhoto: false,
        classId: "class-1",
        className: "Primary 1",
        levelName: "Primary",
        sessionId: "session-1",
        sessionName: "2026/2027",
        currentTermId: "term-1",
        currentTermName: "First Term",
        branchId: "branch-1",
        schoolId: "school-1",
        schoolName: "Portal School",
      },
      terms: [],
    });
    resetSchoolBrandingStore();
    useSchoolBrandingStore.setState({ status: "loaded", schoolName: "Portal School", logoDataUri: undefined });
    resetNavGroupsStore();
    resetInstallPromptStore();
    // Defensive net - every store above is pre-loaded, so fetchIfNeeded should be a no-op, but
    // a stubbed fetch keeps any unexpected call from crashing the test with a real network error.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })),
    );
  });

  afterEach(() => {
    resetFeatureStore();
    vi.unstubAllGlobals();
  });

  it("renders exactly the four-tab cap - Home, Resources, Quizzes, Results - with Timetable in the drawer only", () => {
    resetFeatureStore();
    useFeatureStore.setState({
      status: "loaded",
      onDemandLearning: true,
      takeHomeQuiz: true,
      timetable: true,
    });

    renderStudentLayout();

    const labels = within(tabBar())
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual(["Home", "Resources", "Quizzes", "Results"]);
    // Still reachable, just not as a tab - the More drawer/sidebar copy.
    expect(screen.getAllByText("Timetable").length).toBeGreaterThan(0);
    expect(within(tabBar()).queryByText("Timetable")).not.toBeInTheDocument();
  });

  it("hides Resources entirely without the on-demand-learning entitlement", () => {
    resetFeatureStore();
    useFeatureStore.setState({ status: "loaded", onDemandLearning: false, takeHomeQuiz: true, timetable: true });

    renderStudentLayout();

    expect(screen.queryByText("Resources")).not.toBeInTheDocument();
  });

  it("hides Quizzes entirely without the take-home-quiz entitlement", () => {
    resetFeatureStore();
    useFeatureStore.setState({ status: "loaded", onDemandLearning: true, takeHomeQuiz: false, timetable: true });

    renderStudentLayout();

    expect(screen.queryByText("Quizzes")).not.toBeInTheDocument();
  });

  it("hides Timetable entirely without the timetable entitlement", () => {
    resetFeatureStore();
    useFeatureStore.setState({ status: "loaded", onDemandLearning: true, takeHomeQuiz: true, timetable: false });

    renderStudentLayout();

    expect(screen.queryByText("Timetable")).not.toBeInTheDocument();
  });

  it("re-renders the nav once the feature flags change after mount, without remounting the layout", async () => {
    // Pre-loaded (not "idle") so mount's fetchFeatures() call is a genuine no-op per
    // featureStore's own "fetches once per session" contract - otherwise its real async
    // resolution races the manual setState below and can silently overwrite it.
    resetFeatureStore();
    useFeatureStore.setState({ status: "loaded", onDemandLearning: false, takeHomeQuiz: false, timetable: false });

    renderStudentLayout();

    expect(screen.queryByText("Resources")).not.toBeInTheDocument();

    // Simulates the flags changing from elsewhere in the same session (e.g. a background
    // re-fetch after an admin toggles the package) - StudentLayout subscribes to each flag
    // purely to force this re-render (its own comment).
    useFeatureStore.setState({ onDemandLearning: true, takeHomeQuiz: true, timetable: true });

    await screen.findAllByText("Resources");
    expect(within(tabBar()).getByText("Resources")).toBeInTheDocument();
  });

  it("always shows Home and Results regardless of any feature flag", () => {
    resetFeatureStore();
    useFeatureStore.setState({ status: "loaded", onDemandLearning: false, takeHomeQuiz: false, timetable: false });

    renderStudentLayout();

    expect(within(tabBar()).getByText("Home")).toBeInTheDocument();
    expect(within(tabBar()).getByText("Results")).toBeInTheDocument();
  });
});
