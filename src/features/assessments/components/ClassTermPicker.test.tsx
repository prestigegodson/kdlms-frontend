import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

import { listSessions, listTerms } from "@/api/sessions";

const CURRENT_SESSION: AcademicSessionView = {
  id: "session-current",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const PREVIOUS_SESSION: AcademicSessionView = {
  id: "session-previous",
  schoolId: "school-1",
  name: "2025/2026",
  startDate: "2025-09-01",
  endDate: "2026-07-31",
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

// A past session has no term flagged current - every one of its terms already ran.
const PREVIOUS_TERM_1: TermView = {
  id: "term-previous-1",
  schoolId: "school-1",
  sessionId: "session-previous",
  termNumber: 1,
  name: "First Term",
  startDate: "2025-09-01",
  endDate: "2025-12-01",
  current: false,
};
const PREVIOUS_TERM_2: TermView = {
  id: "term-previous-2",
  schoolId: "school-1",
  sessionId: "session-previous",
  termNumber: 2,
  name: "Second Term",
  startDate: "2026-01-01",
  endDate: "2026-04-01",
  current: false,
};

describe("ClassTermPicker", () => {
  beforeEach(() => {
    vi.mocked(listSessions).mockResolvedValue({
      content: [CURRENT_SESSION, PREVIOUS_SESSION],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    vi.mocked(listTerms).mockImplementation((sessionId: string) =>
      Promise.resolve(sessionId === CURRENT_SESSION.id ? [CURRENT_TERM] : [PREVIOUS_TERM_1, PREVIOUS_TERM_2]),
    );
  });

  it("selects the current session's current term on load", async () => {
    const onTermChange = vi.fn();
    render(
      <ClassTermPicker
        classes={[{ id: "class-1", name: "Class 1" }]}
        classId="class-1"
        onClassChange={vi.fn()}
        termId=""
        onTermChange={onTermChange}
      />,
    );

    await vi.waitFor(() => expect(onTermChange).toHaveBeenCalledWith(CURRENT_TERM.id, CURRENT_TERM.termNumber));
  });

  it("falls back to a previous session's first term instead of leaving termId stale", async () => {
    const user = userEvent.setup();
    const onTermChange = vi.fn();
    render(
      <ClassTermPicker
        classes={[{ id: "class-1", name: "Class 1" }]}
        classId="class-1"
        onClassChange={vi.fn()}
        termId={CURRENT_TERM.id}
        onTermChange={onTermChange}
      />,
    );
    await vi.waitFor(() => expect(onTermChange).toHaveBeenCalledWith(CURRENT_TERM.id, CURRENT_TERM.termNumber));
    onTermChange.mockClear();

    await user.selectOptions(screen.getByLabelText("Session"), PREVIOUS_SESSION.id);

    await vi.waitFor(() =>
      expect(onTermChange).toHaveBeenCalledWith(PREVIOUS_TERM_1.id, PREVIOUS_TERM_1.termNumber),
    );
  });
});
