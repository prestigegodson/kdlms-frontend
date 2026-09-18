import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import type { StudentLinkView } from "@/api/takeHomeQuizzes";
import { StudentLinksPanel } from "@/features/takeHomeQuizzes/components/StudentLinksPanel";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    getTakeHomeQuizLinks: vi.fn(),
    reissueTakeHomeQuizLink: vi.fn(),
    issueMissingTakeHomeQuizLinks: vi.fn(),
    exportTakeHomeQuizLinks: vi.fn(),
    revokeSupersededTakeHomeQuizLinks: vi.fn(),
  };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const ISSUED_LINK: StudentLinkView = {
  studentId: "student-1",
  fullName: "Ada Okoye",
  admissionNumber: "SCH/2026/0001",
  url: "https://app.kdlms.com/take-home-quiz?token=abc123",
  issuedAt: "2026-03-01T00:00:00Z",
  portalStudent: false,
};

const MISSING_LINK: StudentLinkView = {
  studentId: "student-2",
  fullName: "Bola Ade",
  admissionNumber: "SCH/2026/0002",
  url: null,
  issuedAt: null,
  portalStudent: false,
};

const PORTAL_LINK: StudentLinkView = {
  studentId: "student-3",
  fullName: "Chiamaka Eze",
  admissionNumber: "SCH/2026/0003",
  url: null,
  issuedAt: null,
  portalStudent: true,
};

const SUPERSEDED_LINK: StudentLinkView = {
  studentId: "student-4",
  fullName: "Dapo Bello",
  admissionNumber: "SCH/2026/0004",
  url: "https://app.kdlms.com/take-home-quiz?token=stale",
  issuedAt: "2026-03-01T00:00:00Z",
  portalStudent: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("StudentLinksPanel", () => {
  it("lists roster students and copies a link", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([ISSUED_LINK]);
    render(<StudentLinksPanel quizId="quiz-1" refreshToken={0} />);

    expect(await screen.findByText("Ada Okoye")).toBeInTheDocument();
    // `userEvent.setup()` installs its own navigator.clipboard stub - spy on it
    // afterward rather than defining our own, which setup() would just replace.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(ISSUED_LINK.url);
    expect(await screen.findByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("shows a missing-links banner with an Issue links action", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([ISSUED_LINK, MISSING_LINK]);
    vi.mocked(takeHomeQuizzesApi.issueMissingTakeHomeQuizLinks).mockResolvedValue({
      tokensMinted: 1,
      guardiansNotified: 1,
      perStudent: [],
    });
    render(<StudentLinksPanel quizId="quiz-1" refreshToken={0} />);

    expect(await screen.findByText("1 student on the roster has no link yet.")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Issue links" }));

    await waitFor(() => expect(takeHomeQuizzesApi.issueMissingTakeHomeQuizLinks).toHaveBeenCalledWith("quiz-1"));
    // Reload picks up the now-issued link.
    expect(takeHomeQuizzesApi.getTakeHomeQuizLinks).toHaveBeenCalledTimes(2);
  });

  it("downloads the CSV export", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([ISSUED_LINK]);
    const blob = new Blob(["admissionNumber,fullName,link"], { type: "text/csv" });
    vi.mocked(takeHomeQuizzesApi.exportTakeHomeQuizLinks).mockResolvedValue(blob);
    render(<StudentLinksPanel quizId="quiz-1" refreshToken={0} />);

    await screen.findByText("Ada Okoye");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download CSV" }));

    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(blob, "take-home-quiz-links.csv"),
    );
  });

  it("reissues a link after confirmation", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([ISSUED_LINK]);
    vi.mocked(takeHomeQuizzesApi.reissueTakeHomeQuizLink).mockResolvedValue({ ...ISSUED_LINK, url: "https://app.kdlms.com/take-home-quiz?token=new" });
    render(<StudentLinksPanel quizId="quiz-1" refreshToken={0} />);

    await screen.findByText("Ada Okoye");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reissue" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Reissue" }));

    await waitFor(() =>
      expect(takeHomeQuizzesApi.reissueTakeHomeQuizLink).toHaveBeenCalledWith("quiz-1", "student-1"),
    );
  });

  it("shows a portal student as available in the portal, not missing a link", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([ISSUED_LINK, PORTAL_LINK]);
    render(<StudentLinksPanel quizId="quiz-1" refreshToken={0} />);

    expect(await screen.findByText("Available in the student portal")).toBeInTheDocument();
    expect(screen.queryByText(/no link yet/i)).not.toBeInTheDocument();
  });

  it("revokes superseded links after confirmation and reports the outcome", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([ISSUED_LINK, SUPERSEDED_LINK]);
    vi.mocked(takeHomeQuizzesApi.revokeSupersededTakeHomeQuizLinks).mockResolvedValue({
      revoked: 1,
      skippedInProgress: 0,
    });
    render(<StudentLinksPanel quizId="quiz-1" refreshToken={0} />);

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Revoke superseded links \(1\)/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

    await waitFor(() => expect(takeHomeQuizzesApi.revokeSupersededTakeHomeQuizLinks).toHaveBeenCalledWith("quiz-1"));
    expect(await screen.findByText(/Revoked 1 link/)).toBeInTheDocument();
  });
});
