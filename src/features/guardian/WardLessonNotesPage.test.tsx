import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import type { LessonNoteView } from "@/api/lessonNotes";
import { WardLessonNotesPage } from "@/features/guardian/WardLessonNotesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore } from "@/stores/featureStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return {
    ...actual,
    listMyWards: vi.fn(),
    listWardTerms: vi.fn(),
    getWardLessonNotes: vi.fn(),
    getWardLessonNote: vi.fn(),
  };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  currentClassName: "Primary 3",
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const TERM = {
  sessionId: "session-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 3",
  resultsPublished: true,
};

const MATH_NOTE_SUMMARY = {
  noteId: "note-1",
  weekNumber: 1,
  weekStart: "2026-09-07",
  weekEnd: "2026-09-13",
  topic: "Whole numbers",
};

const SUBJECTS = [
  { subjectId: "subject-math", subjectName: "Mathematics", notes: [MATH_NOTE_SUMMARY] },
  { subjectId: "subject-science", subjectName: "Basic Science", notes: [] },
];

const NOTE_DETAIL: LessonNoteView = {
  id: "note-1",
  subjectId: "subject-math",
  subjectName: "Mathematics",
  levelId: "level-1",
  levelName: "Primary",
  termId: "term-1",
  weekNumber: 1,
  topic: "Whole numbers",
  content: {
    subTopic: "Counting",
    duration: "40 minutes",
    averageAge: "8 years",
    objectives: ["Count to 100"],
    entryBehaviour: "Learners can count to 20.",
    instructionalMaterials: ["Chalkboard"],
    references: ["NERDC curriculum"],
    presentation: [{ label: "Step 1", teacherActivity: "Explains counting", learnerActivity: "Counts aloud" }],
    evaluation: "Ask learners to count to 50.",
    conclusion: "Summarize counting.",
    assignment: "Practice counting at home.",
  },
  status: "APPROVED",
  aiGenerated: false,
  updatedByName: "Tara Teacher",
  updatedAt: "2026-09-01T10:00:00Z",
  review: { submittedAt: null, submittedByName: null, reviewedAt: null, reviewedByName: null, reviewComment: null },
  actions: { canEdit: false, canSubmit: false, canWithdraw: false, canReview: false, canReopen: false },
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
  const router = createMemoryRouter([{ path: "/", element: <WardLessonNotesPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("WardLessonNotesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    resetFeatureStore();
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([TERM]);
    vi.mocked(wardsApi.getWardLessonNotes).mockResolvedValue(SUBJECTS);
    vi.mocked(wardsApi.getWardLessonNote).mockResolvedValue(NOTE_DETAIL);
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("shows a retryable error state when the ward list fails to load", async () => {
    vi.mocked(wardsApi.listMyWards).mockRejectedValueOnce(new Error("network down")).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText(/Mathematics/)).toBeInTheDocument();
  });

  it("groups the ward's approved lesson notes into one accordion section per subject", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);

    renderPage();

    expect(await screen.findByText(/Mathematics/)).toBeInTheDocument();
    expect(screen.getByText(/Basic Science/)).toBeInTheDocument();
    expect(screen.getByText(/Week 1 · Whole numbers/)).toBeInTheDocument();
  });

  it("shows a muted message for a subject with no approved notes yet", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);

    renderPage();

    expect(await screen.findByText("No notes published yet.")).toBeInTheDocument();
  });

  it("opens a note read-only in a sheet when its week row is tapped", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText(/Week 1 · Whole numbers/);
    await user.click(screen.getByText(/Week 1 · Whole numbers/));

    expect(await screen.findByText("Counting")).toBeInTheDocument();
    expect(screen.getByText("Ask learners to count to 50.")).toBeInTheDocument();
  });
});
