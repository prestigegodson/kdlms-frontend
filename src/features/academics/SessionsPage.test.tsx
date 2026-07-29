import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { SessionsPage } from "@/features/academics/SessionsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return {
    ...actual,
    listSessions: vi.fn(),
    createSession: vi.fn(),
    setCurrentSession: vi.fn(),
    listTerms: vi.fn(),
    setCurrentTerm: vi.fn(),
  };
});

const CURRENT_SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2025/2026",
  startDate: "2025-09-01",
  endDate: "2026-07-31",
  current: true,
};

const NOT_CURRENT_SESSION: AcademicSessionView = {
  id: "session-2",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: "2027-07-31",
  current: false,
};

function mockList(sessions: AcademicSessionView[]) {
  vi.mocked(sessionsApi.listSessions).mockResolvedValue({
    content: sessions,
    totalElements: sessions.length,
    totalPages: 1,
    number: 0,
    size: 20,
  });
}

function renderAsSchoolAdmin() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  render(<SessionsPage />);
}

describe("SessionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists sessions with a current badge", async () => {
    mockList([CURRENT_SESSION]);

    renderAsSchoolAdmin();

    expect(await screen.findByText("2025/2026")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("creates a session with its three terms in one submit", async () => {
    mockList([]);
    vi.mocked(sessionsApi.createSession).mockResolvedValue(CURRENT_SESSION);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No sessions yet/);

    await user.click(screen.getByRole("button", { name: "Add session" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Session name"), "2026/2027");
    await user.type(within(dialog).getByLabelText("Session start date"), "2026-09-01");
    await user.type(within(dialog).getByLabelText("Session end date"), "2027-07-31");

    const termStartDates = within(dialog).getAllByLabelText("Start date");
    const termEndDates = within(dialog).getAllByLabelText("End date");
    await user.type(termStartDates[0], "2026-09-01");
    await user.type(termEndDates[0], "2026-12-12");
    await user.type(termStartDates[1], "2027-01-05");
    await user.type(termEndDates[1], "2027-03-27");
    await user.type(termStartDates[2], "2027-04-20");
    await user.type(termEndDates[2], "2027-07-31");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "2026/2027",
        startDate: "2026-09-01",
        endDate: "2027-07-31",
        terms: [
          expect.objectContaining({ termNumber: 1, name: "First Term" }),
          expect.objectContaining({ termNumber: 2, name: "Second Term" }),
          expect.objectContaining({ termNumber: 3, name: "Third Term" }),
        ],
      }),
    );
  });

  it("marks a non-current session as current", async () => {
    mockList([NOT_CURRENT_SESSION]);
    vi.mocked(sessionsApi.setCurrentSession).mockResolvedValue({ ...NOT_CURRENT_SESSION, current: true });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("2026/2027");

    await user.click(screen.getByRole("button", { name: "Make current" }));

    expect(sessionsApi.setCurrentSession).toHaveBeenCalledWith("session-2");
  });

  it("expands a session to show and toggle its terms", async () => {
    mockList([NOT_CURRENT_SESSION]);
    const terms: TermView[] = [
      {
        id: "term-1",
        schoolId: "school-1",
        sessionId: "session-2",
        termNumber: 1,
        name: "First Term",
        startDate: "2026-09-01",
        endDate: "2026-12-12",
        current: false,
      },
    ];
    vi.mocked(sessionsApi.listTerms).mockResolvedValue(terms);
    vi.mocked(sessionsApi.setCurrentTerm).mockResolvedValue({ ...terms[0], current: true });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await user.click(await screen.findByRole("button", { name: "2026/2027" }));

    expect(await screen.findByText("First Term")).toBeInTheDocument();

    // Two "Make current" buttons now exist - one for the (not current) session row,
    // one for the (not current) term row just expanded; the term's is the second.
    const makeCurrentButtons = screen.getAllByRole("button", { name: "Make current" });
    await user.click(makeCurrentButtons[1]);

    expect(sessionsApi.setCurrentTerm).toHaveBeenCalledWith("term-1");
  });
});
