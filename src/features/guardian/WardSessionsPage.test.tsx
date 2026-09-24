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

/** One published term per session, `count` past sessions named 2010/2011 upward. */
function pastSessions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...CURRENT_TERM,
    sessionId: `sess-${i}`,
    sessionName: `${2010 + i}/${2011 + i}`,
    currentSession: false,
    termId: `term-${i}`,
  }));
}

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

  it("pages sessions ten at a time and honours ?page= in the URL", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue(pastSessions(12));
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("2021/2022")).toBeInTheDocument();
    expect(screen.getByText("2012/2013")).toBeInTheDocument();
    expect(screen.queryByText("2011/2012")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("2011/2012")).toBeInTheDocument();
    expect(screen.getByText("2010/2011")).toBeInTheDocument();
    expect(screen.queryByText("2021/2022")).not.toBeInTheDocument();
  });

  it("opens the page named in the URL", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue(pastSessions(12));

    renderPage("/guardian/results/s1?page=2");

    expect(await screen.findByText("2010/2011")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("shows no pagination controls when every session fits on one page", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([PAST_TERM_UNPUBLISHED, CURRENT_TERM]);

    renderPage();

    expect(await screen.findByText("2026/2027")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("shows an empty state when the ward has no enrolment history", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No enrolment history yet")).toBeInTheDocument();
  });
});
