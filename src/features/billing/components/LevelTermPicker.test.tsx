import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { LevelTermPicker } from "@/features/billing/components/LevelTermPicker";

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

const PRIMARY: LevelView = {
  id: "level-primary",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 2,
  subjectGroupCount: 0,
};

const CURRENT_SESSION: AcademicSessionView = {
  id: "session-current",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const FUTURE_SESSION: AcademicSessionView = {
  id: "session-future",
  schoolId: "school-1",
  name: "2027/2028",
  startDate: "2027-09-01",
  endDate: null,
  current: false,
};

const CURRENT_TERM: TermView = {
  id: "term-current",
  schoolId: "school-1",
  sessionId: "session-current",
  termNumber: 1,
  name: "First Term",
  startDate: "2026-09-01",
  endDate: "2026-12-01",
  current: true,
};

function Harness({ defaultCurrentSession }: { defaultCurrentSession: boolean }) {
  const [levelId, setLevelId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  return (
    <LevelTermPicker
      levelId={levelId}
      onLevelChange={setLevelId}
      sessionId={sessionId}
      onSessionChange={setSessionId}
      termId={termId}
      onTermChange={setTermId}
      defaultCurrentSession={defaultCurrentSession}
      idPrefix="harness"
    />
  );
}

describe("LevelTermPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [CURRENT_SESSION, FUTURE_SESSION],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([CURRENT_TERM]);
  });

  it("defaults to the current session and its current term when defaultCurrentSession is true", async () => {
    render(<Harness defaultCurrentSession />);

    expect(await screen.findByLabelText("Session")).toHaveValue("session-current");
    await waitFor(() => expect(screen.getByLabelText("Term")).toHaveValue("term-current"));
  });

  it("starts with nothing selected when defaultCurrentSession is false", async () => {
    render(<Harness defaultCurrentSession={false} />);

    await screen.findByText("Primary");
    expect(screen.getByLabelText("Session")).toHaveValue("");
    expect(screen.getByLabelText("Term")).toBeDisabled();
    expect(sessionsApi.listTerms).not.toHaveBeenCalled();
  });

  it("clears the selected term when the session changes", async () => {
    const user = userEvent.setup();
    render(<Harness defaultCurrentSession={false} />);
    await screen.findByText("Primary");

    await user.selectOptions(screen.getByLabelText("Session"), "session-current");
    await screen.findByLabelText("Term");
    await user.selectOptions(screen.getByLabelText("Term"), "term-current");
    expect(screen.getByLabelText("Term")).toHaveValue("term-current");

    vi.mocked(sessionsApi.listTerms).mockResolvedValue([]);
    await user.selectOptions(screen.getByLabelText("Session"), "session-future");

    expect(screen.getByLabelText("Term")).toHaveValue("");
  });

  it("uses a custom session label when provided", async () => {
    render(
      <LevelTermPicker
        levelId=""
        onLevelChange={() => undefined}
        sessionId=""
        onSessionChange={() => undefined}
        termId=""
        onTermChange={() => undefined}
        sessionLabel="Session to advance-bill"
        idPrefix="advance-bills"
      />,
    );

    expect(await screen.findByLabelText("Session to advance-bill")).toBeInTheDocument();
  });
});
