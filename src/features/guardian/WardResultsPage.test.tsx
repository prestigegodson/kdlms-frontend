import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardResultsPage } from "@/features/guardian/WardResultsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore, useWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn(), getWardResult: vi.fn() };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  status: "ACTIVE",
};

function renderPage() {
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
  const router = createMemoryRouter([{ path: "/", element: <WardResultsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("WardResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("tells the guardian there are no published results yet when the ward's published-term list is empty", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([
      {
        sessionId: "sess-1",
        sessionName: "2026/2027",
        currentSession: true,
        termId: "term-1",
        termName: "First Term",
        termNumber: 1,
        classId: "class-1",
        resultsPublished: false,
      },
    ]);

    renderPage();

    expect(await screen.findByText("No published results yet for this ward.")).toBeInTheDocument();
  });

  it("renders a published term result once a term is selected", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([
      {
        sessionId: "sess-1",
        sessionName: "2026/2027",
        currentSession: true,
        termId: "term-1",
        termName: "First Term",
        termNumber: 1,
        classId: "class-1",
        resultsPublished: true,
      },
    ]);
    vi.mocked(wardsApi.getWardResult).mockResolvedValue({
      result: {
        studentId: "s1",
        enrollmentId: "enr-1",
        studentName: "Ada Obi",
        admissionNumber: "SCH/2026/0001",
        classId: "class-1",
        termId: "term-1",
        assessmentMode: "NUMERIC",
        subjects: [{ subjectId: "subj-1", name: "Mathematics" }],
        subjectResults: [{ subjectId: "subj-1", finalScore: 88, grade: "A" }],
        total: 176,
        average: 88,
        position: 1,
      },
      gradingSystem: {
        levelId: "level-1",
        levelName: "Primary",
        baseLevel: "PRIMARY",
        assessmentMode: "NUMERIC",
        showPosition: true,
        boundaries: [{ grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" }],
        ratingOptions: [],
        configured: true,
      },
    });

    renderPage();
    useWardStore.setState({ selectedWardId: "s1" });

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("176")).toBeInTheDocument();
  });
});
