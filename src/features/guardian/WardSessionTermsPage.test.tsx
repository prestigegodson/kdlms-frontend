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
};

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

  it("lists a session's terms in term-number order, published terms linked and badged", async () => {
    renderPage("/guardian/results/s1/sess-1");

    const firstTerm = await screen.findByText("First Term");
    expect(firstTerm).toBeInTheDocument();
    expect(screen.getByText("Second Term")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Not published yet")).toBeInTheDocument();
    expect(wardsApi.getWardResult).not.toHaveBeenCalled();
  });

  it("navigates to the report only for a published term", async () => {
    const user = userEvent.setup();

    renderPage("/guardian/results/s1/sess-1");
    await user.click(await screen.findByText("First Term"));

    expect(await screen.findByText("Ward result page")).toBeInTheDocument();
  });

  it("shows 'Session not found' for a session id that isn't part of this ward's history", async () => {
    renderPage("/guardian/results/s1/unknown-session");

    expect(
      await screen.findByText("This session isn't part of this ward's enrolment history."),
    ).toBeInTheDocument();
  });
});
