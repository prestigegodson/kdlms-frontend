import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Navigate, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import type { WardTermView } from "@/api/wards";
import { WardResultsHomePage } from "@/features/guardian/WardResultsHomePage";
import { WardResultsLayout } from "@/features/guardian/WardResultsLayout";
import { WardResultsPage } from "@/features/guardian/WardResultsPage";
import { WardTermResultPage } from "@/features/guardian/WardTermResultPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn(), getWardResult: vi.fn() };
});

const WARD_A = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const WARD_B = {
  studentId: "s2",
  fullName: "Bode Obi",
  admissionNumber: "SCH/2026/0002",
  relationship: "MOTHER",
  gender: "MALE" as const,
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

function term(overrides: Partial<WardTermView> & Pick<WardTermView, "termId">): WardTermView {
  return {
    sessionId: "sess-cur",
    sessionName: "2026/2027",
    currentSession: true,
    termName: "First Term",
    termNumber: 1,
    classId: "class-a",
    className: "Primary 3",
    resultsPublished: false,
    midtermPublished: false,
    ...overrides,
  };
}

// Ward A: current session's Second Term has only its mid-term out (the latest),
// First Term has both, and last session's Third Term has end of term only.
const WARD_A_TERMS = [
  term({ termId: "cur-2", termName: "Second Term", termNumber: 2, midtermPublished: true }),
  term({ termId: "cur-1", resultsPublished: true, midtermPublished: true }),
  term({ termId: "cur-3", termName: "Third Term", termNumber: 3 }),
  term({
    termId: "past-3",
    sessionId: "sess-past",
    sessionName: "2025/2026",
    currentSession: false,
    className: "Primary 2",
    termName: "Third Term",
    termNumber: 3,
    resultsPublished: true,
  }),
];

const WARD_B_TERMS = [term({ termId: "b-1", classId: "class-b", className: "Primary 5", resultsPublished: true })];

const RESULT_A = {
  result: {
    studentId: "s1",
    enrollmentId: "enr-a",
    studentName: "Ada Obi",
    admissionNumber: "SCH/2026/0001",
    classId: "class-a",
    termId: "term-a",
    assessmentMode: "NUMERIC" as const,
    subjects: [{ subjectId: "subj-1", name: "Mathematics" }],
    subjectResults: [{ subjectId: "subj-1", finalScore: 88, grade: "A" }],
    total: 176,
    average: 88,
    position: 1,
    principalRemarkTitle: "Principal",
    traits: [],
  },
  gradingSystem: {
    levelId: "level-1",
    levelName: "Primary",
    baseLevel: "PRIMARY" as const,
    assessmentMode: "NUMERIC" as const,
    showPosition: true,
    showMidtermGrade: true,
    boundaries: [{ grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" }],
    ratingOptions: [],
    configured: true,
  },
  traitConfiguration: {
    levelId: "level-1",
    levelName: "Primary",
    affectiveEnabled: false,
    psychomotorEnabled: false,
    affective: { scaleOptions: [], traits: [] },
    psychomotor: { scaleOptions: [], traits: [] },
    configured: false,
  },
};

function renderApp(initialPath = "/guardian/results") {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "guardian-1",
      email: "guardian@example.com",
      firstName: "Gina",
      lastName: "G",
      role: "GUARDIAN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [
      {
        path: "/guardian/results",
        children: [
          { index: true, element: <WardResultsPage /> },
          {
            path: ":studentId",
            element: <WardResultsLayout />,
            children: [
              { index: true, element: <WardResultsHomePage /> },
              { path: ":sessionId", element: <Navigate to="..?tab=past" replace /> },
              { path: ":sessionId/:termId", element: <WardTermResultPage /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("WardResultsHomePage (latest result + past results)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD_A, WARD_B]);
    vi.mocked(wardsApi.listWardTerms).mockImplementation((studentId) =>
      Promise.resolve(studentId === "s1" ? WARD_A_TERMS : WARD_B_TERMS),
    );
    vi.mocked(wardsApi.getWardResult).mockResolvedValue(RESULT_A);
  });

  it("opens straight onto the first ward's latest published result", async () => {
    renderApp();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Second Term · 2026/2027" })).toBeInTheDocument();
    expect(screen.getByText("Mid-term · Primary 3")).toBeInTheDocument();
    expect(wardsApi.getWardResult).toHaveBeenCalledWith("s1", "cur-2", "MIDTERM");
    expect(screen.getByRole("tab", { name: "Latest result" })).toHaveAttribute("aria-selected", "true");
  });

  it("lists every other result on the Past tab, leaving out the latest one", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByText("Mathematics");

    await user.click(screen.getByRole("tab", { name: "Past results" }));

    expect(screen.getByRole("heading", { name: "2026/2027" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2025/2026" })).toBeInTheDocument();
    // The latest (Second Term mid-term) isn't repeated here.
    expect(screen.queryByRole("link", { name: "Second Term mid-term result" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "First Term end of term result" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "First Term mid-term result" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Third Term end of term result" })).toBeInTheDocument();
    // The never-published current Third Term stays as a muted row.
    expect(screen.getByText("Not published yet")).toBeInTheDocument();
  });

  it("opens a past report and comes back to the Past tab", async () => {
    const user = userEvent.setup();
    renderApp("/guardian/results/s1?tab=past");

    await user.click(await screen.findByRole("link", { name: "First Term mid-term result" }));

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(wardsApi.getWardResult).toHaveBeenLastCalledWith("s1", "cur-1", "MIDTERM");

    await user.click(screen.getByRole("link", { name: "Past results" }));

    expect(await screen.findByRole("tab", { name: "Past results" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches ward from the selector and keeps the current tab", async () => {
    const user = userEvent.setup();
    const router = renderApp("/guardian/results/s1?tab=past");
    await screen.findByRole("link", { name: "First Term end of term result" });

    await user.selectOptions(screen.getByLabelText("Ward"), "s2");

    expect(await screen.findByText("No past results yet")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/guardian/results/s2");
    expect(router.state.location.search).toBe("?tab=past");
    expect(wardsApi.listWardTerms).toHaveBeenCalledWith("s2");
  });

  it("hides the ward selector for a guardian with one ward", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD_A]);
    renderApp();

    await screen.findByText("Mathematics");

    expect(screen.queryByLabelText("Ward")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing has been published yet", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([term({ termId: "cur-1" })]);
    renderApp("/guardian/results/s1");

    expect(await screen.findByText("No results published yet")).toBeInTheDocument();
    expect(wardsApi.getWardResult).not.toHaveBeenCalled();
  });

  it("redirects an old session bookmark to the Past tab", async () => {
    const router = renderApp("/guardian/results/s1/sess-cur");

    const tabs = await screen.findByRole("tablist", { name: "Results" });
    expect(within(tabs).getByRole("tab", { name: "Past results" })).toHaveAttribute("aria-selected", "true");
    expect(router.state.location.pathname).toBe("/guardian/results/s1");
  });
});
