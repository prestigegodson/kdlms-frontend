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
    updateSession: vi.fn(),
    setCurrentSession: vi.fn(),
    listTerms: vi.fn(),
    addTerm: vi.fn(),
    updateTerm: vi.fn(),
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

  it("creates a session with just its first term and no end date", async () => {
    mockList([]);
    vi.mocked(sessionsApi.createSession).mockResolvedValue(CURRENT_SESSION);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No sessions yet/);

    await user.click(screen.getByRole("button", { name: "Add session" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Session name"), "2026/2027");
    await user.type(within(dialog).getByLabelText("Session start date"), "2026-09-01");
    // Session end date and terms 2/3 are left blank - they're unknown yet.
    expect(within(dialog).queryAllByLabelText("Start date")).toHaveLength(1);

    await user.type(within(dialog).getByLabelText("Start date"), "2026-09-01");
    await user.type(within(dialog).getByLabelText("End date"), "2026-12-12");

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "2026/2027",
        startDate: "2026-09-01",
        endDate: null,
        terms: [expect.objectContaining({ termNumber: 1, name: "First Term" })],
      }),
    );
  });

  it("allows adding further terms before submitting the create form", async () => {
    mockList([]);
    vi.mocked(sessionsApi.createSession).mockResolvedValue(CURRENT_SESSION);
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText(/No sessions yet/);

    await user.click(screen.getByRole("button", { name: "Add session" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Add Second Term" }));
    await user.click(within(dialog).getByRole("button", { name: "Add Third Term" }));
    expect(within(dialog).getAllByLabelText("Start date")).toHaveLength(3);
    expect(within(dialog).queryByRole("button", { name: /Add Third Term/ })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Remove Third Term" }));
    expect(within(dialog).getAllByLabelText("Start date")).toHaveLength(2);
  });

  it("edits an existing session's name and dates", async () => {
    mockList([NOT_CURRENT_SESSION]);
    vi.mocked(sessionsApi.updateSession).mockResolvedValue({
      ...NOT_CURRENT_SESSION,
      endDate: "2027-08-15",
    });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await screen.findByText("2026/2027");

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    const endDate = within(dialog).getByLabelText("Session end date (optional)");
    await user.clear(endDate);
    await user.type(endDate, "2027-08-15");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(sessionsApi.updateSession).toHaveBeenCalledWith(
      "session-2",
      expect.objectContaining({ endDate: "2027-08-15" }),
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

  it("adds the next term to a session that only has its first", async () => {
    mockList([NOT_CURRENT_SESSION]);
    const firstTerm: TermView = {
      id: "term-1",
      schoolId: "school-1",
      sessionId: "session-2",
      termNumber: 1,
      name: "First Term",
      startDate: "2026-09-01",
      endDate: "2026-12-12",
      current: false,
    };
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([firstTerm]);
    vi.mocked(sessionsApi.addTerm).mockResolvedValue({
      ...firstTerm,
      id: "term-2",
      termNumber: 2,
      name: "Second Term",
    });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await user.click(await screen.findByRole("button", { name: "2026/2027" }));
    await screen.findByText("First Term");

    await user.click(screen.getByRole("button", { name: "Add Second Term" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Start date"), "2027-01-05");
    await user.type(within(dialog).getByLabelText("End date"), "2027-03-27");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(sessionsApi.addTerm).toHaveBeenCalledWith("session-2", {
      termNumber: 2,
      name: "Second Term",
      startDate: "2027-01-05",
      endDate: "2027-03-27",
    });
  });

  it("edits an existing term's name and dates", async () => {
    mockList([NOT_CURRENT_SESSION]);
    const firstTerm: TermView = {
      id: "term-1",
      schoolId: "school-1",
      sessionId: "session-2",
      termNumber: 1,
      name: "First Term",
      startDate: "2026-09-01",
      endDate: "2026-12-12",
      current: false,
    };
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([firstTerm]);
    vi.mocked(sessionsApi.updateTerm).mockResolvedValue({ ...firstTerm, startDate: "2026-09-02" });
    const user = userEvent.setup();

    renderAsSchoolAdmin();
    await user.click(await screen.findByRole("button", { name: "2026/2027" }));
    await screen.findByText("First Term");

    // Two "Edit" buttons now exist - one for the session row, one for the term row.
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    await user.click(editButtons[1]);
    const dialog = await screen.findByRole("dialog");

    const startDate = within(dialog).getByLabelText("Start date");
    await user.clear(startDate);
    await user.type(startDate, "2026-09-02");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(sessionsApi.updateTerm).toHaveBeenCalledWith(
      "term-1",
      expect.objectContaining({ startDate: "2026-09-02" }),
    );
  });
});
