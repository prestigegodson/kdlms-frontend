import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/api/types";
import { ApiError } from "@/api/client";
import * as insightsApi from "@/api/insights";
import type { ClassInsightsView, InsightSummaryView } from "@/api/insights";
import { InsightsPage } from "@/features/insights/InsightsPage";
import type { BranchView } from "@/api/branches";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore, useBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";

vi.mock("@/api/insights", async () => {
  const actual = await vi.importActual<typeof import("@/api/insights")>("@/api/insights");
  return { ...actual, getInsightsSummary: vi.fn(), getClassInsights: vi.fn(), recomputeClassInsights: vi.fn() };
});

const summary: InsightSummaryView = {
  termId: "t1",
  termName: "First Term",
  atRisk: 1,
  watch: 1,
  none: 30,
  computedAt: "2026-10-30T02:00:00Z",
  classes: [
    { classId: "c1", className: "Primary 1", levelName: "Primary", branchId: "b1", atRisk: 0, watch: 0, total: 15 },
    { classId: "c2", className: "Primary 2", levelName: "Primary", branchId: "b2", atRisk: 1, watch: 1, total: 17 },
  ],
};

const twoBranches: BranchView[] = [
  { id: "b1", schoolId: "school-1", name: "Main Campus", main: true, status: "ACTIVE" },
  { id: "b2", schoolId: "school-1", name: "Lekki Campus", main: false, status: "ACTIVE" },
];

function classView(classId: string): ClassInsightsView {
  if (classId === "c1") {
    return { classId: "c1", className: "Primary 1", termId: "t1", termName: "First Term", totalStudents: 15, computedAt: "2026-10-30T02:00:00Z", students: [] };
  }
  return {
    classId: "c2",
    className: "Primary 2",
    termId: "t1",
    termName: "First Term",
    totalStudents: 17,
    computedAt: "2026-10-30T02:00:00Z",
    students: [
      {
        studentId: "s1",
        fullName: "Ada Obi",
        admissionNumber: "KDL-001",
        severity: "AT_RISK",
        reasons: [
          { signal: "AVERAGE_DROP", message: "Term average fell 12.5 points, from 70.0 to 57.5", detail: {} },
          { signal: "LOW_ATTENDANCE", message: "Attendance is 72.0% this term, below 80.0%", detail: {} },
        ],
        metrics: {},
        firstAtRiskAt: "2026-10-12T02:00:00Z",
      },
      {
        studentId: "s2",
        fullName: "Bayo Ade",
        severity: "WATCH",
        reasons: [{ signal: "MISSED_QUIZZES", message: "Missed 2 take-home quizzes this term", detail: {} }],
        metrics: {},
      },
    ],
  };
}

function renderAs(
  role: Role,
  { headOfLevel = false, entry = "/school/insights", branches = twoBranches }: { headOfLevel?: boolean; entry?: string; branches?: BranchView[] } = {},
) {
  resetAuthStore();
  resetBranchStore();
  useBranchStore.setState({ branches, selectedBranchId: branches[0]?.id ?? null, status: "loaded" });
  useAuthStore.setState({
    user: { id: "u-1", email: "u@school.example", firstName: "A", lastName: "B", role, schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useTeacherScopeStore.setState({
    capabilities: {
      isClassTeacher: false,
      classTeacherClassIds: [],
      subjectTeacherClassIds: [],
      headOfLevelIds: headOfLevel ? ["level-1"] : [],
    },
    status: "loaded",
  });
  const router = createMemoryRouter(
    [
      { path: "/school/insights", element: <InsightsPage /> },
      { path: "/school/insights/students/:studentId", element: <div>Student insight page</div> },
    ],
    { initialEntries: [entry] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("InsightsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureStore();
    useFeatureStore.setState({ studentInsights: true, status: "loaded" });
    vi.mocked(insightsApi.getInsightsSummary).mockResolvedValue(summary);
    vi.mocked(insightsApi.getClassInsights).mockImplementation((classId) => Promise.resolve(classView(classId)));
  });

  it("opens the most-flagged class and lists its students with severity and every reason", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(insightsApi.getClassInsights).toHaveBeenCalledWith("c2");
    const adaRow = screen.getByText("Ada Obi").closest("tr") as HTMLElement;
    expect(within(adaRow).getByText("At risk")).toBeInTheDocument();
    expect(within(adaRow).getByText("Average drop")).toBeInTheDocument();
    expect(within(adaRow).getByText("Term average fell 12.5 points, from 70.0 to 57.5")).toBeInTheDocument();
    expect(within(adaRow).getByText("Low attendance")).toBeInTheDocument();
    expect(within(adaRow).getByText("KDL-001")).toBeInTheDocument();
    const bayoRow = screen.getByText("Bayo Ade").closest("tr") as HTMLElement;
    expect(within(bayoRow).getByText("Watch")).toBeInTheDocument();
    expect(screen.getAllByText(/Updated/).length).toBeGreaterThan(0);
  });

  it("switches class from the picker and shows the class's empty state", async () => {
    renderAs("TEACHER");
    await screen.findByText("Ada Obi");

    await userEvent.selectOptions(screen.getByLabelText("Class"), "c1");

    expect(await screen.findByText("No students flagged in Primary 1")).toBeInTheDocument();
    expect(screen.getByText("15 students checked.")).toBeInTheDocument();
  });

  it("honours a classId in the URL", async () => {
    renderAs("SCHOOL_ADMIN", { entry: "/school/insights?classId=c1" });

    expect(await screen.findByText("No students flagged in Primary 1")).toBeInTheDocument();
  });

  it("drills down to a student's insights from their row", async () => {
    const router = renderAs("TEACHER");

    await userEvent.click(await screen.findByText("Ada Obi"));

    expect(router.state.location.pathname).toBe("/school/insights/students/s1");
  });

  it("lets an admin queue a recompute and says it isn't instant", async () => {
    vi.mocked(insightsApi.recomputeClassInsights).mockResolvedValue(undefined);
    renderAs("BRANCH_ADMIN");
    await screen.findByText("Ada Obi");

    await userEvent.click(screen.getByRole("button", { name: /Recompute now/ }));

    expect(insightsApi.recomputeClassInsights).toHaveBeenCalledWith("c2");
    expect(await screen.findByText(/Recompute queued/)).toBeInTheDocument();
  });

  it("shows the server's message when a recompute is refused", async () => {
    vi.mocked(insightsApi.recomputeClassInsights).mockRejectedValue(
      new ApiError(403, "You can only recompute insights for classes in your branch.", {
        type: "https://kdlms.com/problems/forbidden",
        detail: "You can only recompute insights for classes in your branch.",
      }),
    );
    renderAs("BRANCH_ADMIN");
    await screen.findByText("Ada Obi");

    await userEvent.click(screen.getByRole("button", { name: /Recompute now/ }));

    expect(await screen.findByText("You can only recompute insights for classes in your branch.")).toBeInTheDocument();
  });

  it("hides Recompute now and Settings from a teacher (a Head of Level included)", async () => {
    renderAs("TEACHER", { headOfLevel: true });
    await screen.findByText("Ada Obi");

    expect(screen.queryByRole("button", { name: /Recompute now/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("offers Settings to a school admin only", async () => {
    renderAs("SCHOOL_ADMIN");
    await screen.findByText("Ada Obi");

    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("href", "/school/insights/settings");
  });

  it("lets a school admin of a multi-branch school narrow the classes to one branch", async () => {
    const router = renderAs("SCHOOL_ADMIN");
    await screen.findByText("Ada Obi");

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "b1");

    expect(await screen.findByText("No students flagged in Primary 1")).toBeInTheDocument();
    const classOptions = within(screen.getByLabelText("Class")).getAllByRole("option");
    expect(classOptions.map((option) => option.textContent)).toEqual(["Primary 1"]);
    expect(router.state.location.search).toBe("?branch=b1");
  });

  it("restores a branch from the URL", async () => {
    renderAs("SCHOOL_ADMIN", { entry: "/school/insights?branch=b1" });

    expect(await screen.findByText("No students flagged in Primary 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Branch")).toHaveValue("b1");
    expect(insightsApi.getClassInsights).not.toHaveBeenCalledWith("c2");
  });

  it("shows no branch filter for a single-branch school", async () => {
    renderAs("SCHOOL_ADMIN", { branches: twoBranches.slice(0, 1) });
    await screen.findByText("Ada Obi");

    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
  });

  it("shows no branch filter to a branch admin", async () => {
    renderAs("BRANCH_ADMIN");
    await screen.findByText("Ada Obi");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
  });

  it("shows the upgrade notice, with a plans link for a school admin, when not entitled", async () => {
    useFeatureStore.setState({ studentInsights: false, status: "loaded" });
    renderAs("SCHOOL_ADMIN");

    expect(await screen.findByText("Student insights aren't in your plan")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/school/subscription");
  });

  it("shows the upgrade notice without a plans link for a teacher", async () => {
    useFeatureStore.setState({ studentInsights: false, status: "loaded" });
    renderAs("TEACHER");

    expect(await screen.findByText("Student insights aren't in your plan")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See plans" })).not.toBeInTheDocument();
  });

  it("shows the upgrade notice on a feature-not-included 403 the feature store hadn't caught", async () => {
    vi.mocked(insightsApi.getInsightsSummary).mockRejectedValue(
      new ApiError(403, "Student insights are not included in the current plan.", {
        type: "https://kdlms.com/problems/feature-not-included",
        detail: "Student insights are not included in the current plan.",
      }),
    );
    renderAs("SCHOOL_ADMIN");

    expect(await screen.findByText("Student insights aren't in your plan")).toBeInTheDocument();
  });
});
