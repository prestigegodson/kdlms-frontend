import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardResultsLayout } from "@/features/guardian/WardResultsLayout";
import { WardResultsPage } from "@/features/guardian/WardResultsPage";
import { WardSessionsPage } from "@/features/guardian/WardSessionsPage";
import { WardSessionTermsPage } from "@/features/guardian/WardSessionTermsPage";
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

const TERM_A = {
  sessionId: "sess-a",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-a",
  termName: "First Term",
  termNumber: 1,
  classId: "class-a",
  className: "Primary 3",
  resultsPublished: true,
  midtermPublished: false,
};

const TERM_B = {
  sessionId: "sess-b",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-b",
  termName: "First Term",
  termNumber: 1,
  classId: "class-b",
  className: "Primary 4",
  resultsPublished: true,
  midtermPublished: false,
};

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

function renderApp() {
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
              { index: true, element: <WardSessionsPage /> },
              { path: ":sessionId", element: <WardSessionTermsPage /> },
              { path: ":sessionId/:termId", element: <WardTermResultPage /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: ["/guardian/results"] },
  );
  render(<RouterProvider router={router} />);
}

describe("Guardian results drill-down (School -> Ward -> Session -> Term -> Report)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD_A, WARD_B]);
    vi.mocked(wardsApi.listWardTerms).mockImplementation((studentId) =>
      Promise.resolve(studentId === "s1" ? [TERM_A] : [TERM_B]),
    );
    vi.mocked(wardsApi.getWardResult).mockResolvedValue(RESULT_A);
  });

  it("walks ward A down to its report, then back up and into ward B without carrying ward A's term over", async () => {
    const user = userEvent.setup();
    renderApp();

    // Step 1: pick ward A.
    await user.click(await screen.findByText("Ada Obi"));

    // Step 2: pick its session.
    await user.click(await screen.findByText("2026/2027"));

    // Step 3: pick its term - the End of term row, since only that scope is published here.
    await user.click(await screen.findByText("End of term"));

    // Step 4: the report.
    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(wardsApi.getWardResult).toHaveBeenCalledWith("s1", "term-a", "TERM");

    // Back to step 1 via the breadcrumb, then into ward B.
    await user.click(screen.getByRole("link", { name: "Bright Star Academy" }));
    await user.click(await screen.findByText("Bode Obi"));

    // Ward B's own session list, not ward A's term result.
    expect(await screen.findByText("2026/2027")).toBeInTheDocument();
    expect(screen.queryByText("Mathematics")).not.toBeInTheDocument();
    expect(wardsApi.listWardTerms).toHaveBeenCalledWith("s2");
  });
});
