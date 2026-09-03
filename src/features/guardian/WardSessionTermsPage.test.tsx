import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardResultsLayout } from "@/features/guardian/WardResultsLayout";
import { WardSessionTermsPage } from "@/features/guardian/WardSessionTermsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore } from "@/stores/wardStore";

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
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

// Both scopes published.
const TERM_1 = {
  sessionId: "sess-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 3",
  resultsPublished: true,
  midtermPublished: true,
};

// Only the mid-term has been published - end of term is still disabled.
const TERM_2 = {
  sessionId: "sess-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-2",
  termName: "Second Term",
  termNumber: 2,
  classId: "class-1",
  className: "Primary 3",
  resultsPublished: false,
  midtermPublished: true,
};

function renderPage(initialPath: string) {
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
          { path: ":sessionId", element: <WardSessionTermsPage /> },
          { path: ":sessionId/:termId", element: <p>Ward result page</p> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

describe("WardSessionTermsPage (step 3 - terms)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([TERM_2, TERM_1]);
  });

  it("lists a session's terms in term-number order, each split into a Mid-term and End of term row", async () => {
    renderPage("/guardian/results/s1/sess-1");

    expect(await screen.findByText("First Term · Primary 3")).toBeInTheDocument();
    expect(screen.getByText("Second Term · Primary 3")).toBeInTheDocument();
    // Term 1: both scopes published - two "Published" badges.
    // Term 2: only mid-term published - one "Published" badge, one "Not published yet".
    expect(screen.getAllByText("Published")).toHaveLength(3);
    expect(screen.getAllByText("Not published yet")).toHaveLength(1);
    expect(wardsApi.getWardResult).not.toHaveBeenCalled();
  });

  it("offers an enabled Mid-term row and a disabled End of term row for a term with only its mid-term published", async () => {
    renderPage("/guardian/results/s1/sess-1");

    await screen.findByText("Second Term · Primary 3");
    const midtermRows = screen.getAllByText("Mid-term");
    const secondTermMidterm = midtermRows[1].closest("a");
    expect(secondTermMidterm).toHaveAttribute("href", "/guardian/results/s1/sess-1/term-2?scope=MIDTERM");

    const endOfTermRows = screen.getAllByText("End of term");
    expect(endOfTermRows[1].closest("a")).toBeNull();
  });

  it("navigates to the report for a published End of term row", async () => {
    const user = userEvent.setup();

    renderPage("/guardian/results/s1/sess-1");
    await user.click((await screen.findAllByText("End of term"))[0]);

    expect(await screen.findByText("Ward result page")).toBeInTheDocument();
  });

  it("shows 'Session not found' for a session id that isn't part of this ward's history", async () => {
    renderPage("/guardian/results/s1/unknown-session");

    expect(
      await screen.findByText("This session isn't part of this ward's enrolment history."),
    ).toBeInTheDocument();
  });
});
