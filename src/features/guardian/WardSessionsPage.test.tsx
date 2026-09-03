import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardResultsLayout } from "@/features/guardian/WardResultsLayout";
import { WardSessionsPage } from "@/features/guardian/WardSessionsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn() };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const CURRENT_TERM = {
  sessionId: "sess-2",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-3",
  termName: "First Term",
  termNumber: 1,
  classId: "class-2",
  className: "Primary 4",
  resultsPublished: true,
  midtermPublished: false,
};

const PAST_TERM_UNPUBLISHED = {
  sessionId: "sess-1",
  sessionName: "2025/2026",
  currentSession: false,
  termId: "term-1",
  termName: "Third Term",
  termNumber: 3,
  classId: "class-1",
  className: "Primary 3",
  resultsPublished: false,
  midtermPublished: false,
};

function renderPage(initialPath = "/guardian/results/s1") {
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
        path: "/guardian/results/:studentId",
        element: <WardResultsLayout />,
        children: [
          { index: true, element: <WardSessionsPage /> },
          { path: ":sessionId", element: <p>Ward terms page</p> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

describe("WardSessionsPage (step 2 - sessions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
  });

  it("lists one row per session, current session first and badged", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([PAST_TERM_UNPUBLISHED, CURRENT_TERM]);

    renderPage();

    const currentRow = await screen.findByText("2026/2027");
    expect(currentRow).toBeInTheDocument();
    expect(screen.getByText("2025/2026")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("1 published")).toBeInTheDocument();
  });

  it("shows a session with no published terms as disabled rather than hiding it", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([PAST_TERM_UNPUBLISHED]);

    renderPage();

    expect(await screen.findByText("2025/2026")).toBeInTheDocument();
    expect(screen.getByText("No published results yet")).toBeInTheDocument();
  });

  it("links a session with published terms to the term list", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([CURRENT_TERM]);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByText("2026/2027"));

    expect(await screen.findByText("Ward terms page")).toBeInTheDocument();
  });

  it("shows an empty state when the ward has no enrolment history", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No enrolment history yet")).toBeInTheDocument();
  });
});
