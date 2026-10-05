import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorPlanApi from "@/api/creatorPlan";
import type { CreatorPlanView } from "@/api/creatorPlan";
import * as lessonNotesApi from "@/api/lessonNotes";
import type { ClassLessonNoteView } from "@/api/lessonNotes";
import * as virtualClassesApi from "@/api/virtualClasses";
import { EMPTY_CONTENT } from "@/features/lessonNotes/lessonNoteFormState";
import { resetCreatorPlanStore } from "@/stores/creatorPlanStore";
import { CreatorLessonNoteEditorPage } from "./CreatorLessonNoteEditorPage";

vi.mock("@/api/creatorPlan");
vi.mock("@/api/lessonNotes");
vi.mock("@/api/virtualClasses");

const PLAN = {
  source: "SUBSCRIPTION",
  packageId: "pkg",
  planName: "Pro",
  free: false,
  billingCycle: "MONTHLY",
  startDate: "2026-10-01",
  endDate: "2026-11-01",
  maxClasses: 5,
  maxStudentsPerClass: 10,
  maxSessionMinutes: 60,
  maxParticipantsPerSession: null,
  maxMonthlySessionHours: 10,
  lessonNotes: true,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  takeHomeQuiz: false,
  onDemandLearning: false,
  learningMedia: false,
  communication: false,
  guardianAccess: false,
  autoRenew: false,
  graceUntil: null,
} satisfies CreatorPlanView;

const DRAFT: ClassLessonNoteView = {
  id: "n1",
  classId: "c1",
  className: "Maths",
  sessionDate: null,
  topic: "Fractions",
  content: EMPTY_CONTENT,
  status: "DRAFT",
  aiGenerated: false,
  updatedAt: "2026-10-04T09:00:00Z",
  publishedAt: null,
  actions: { canEdit: true, canPublish: true, canUnpublish: false, canDelete: true },
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/creator/lesson-notes/:classId/:noteId", element: <CreatorLessonNoteEditorPage /> },
      { path: "/creator/lesson-notes", element: <p>List page</p> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe("CreatorLessonNoteEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreatorPlanStore();
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue(PLAN);
    vi.mocked(virtualClassesApi.getVirtualClass).mockResolvedValue({
      id: "c1",
      name: "Maths",
      description: null,
      subjectLabel: null,
      status: "ACTIVE",
      startDate: "2026-10-01",
      endDate: null,
      overLimit: false,
      slots: [],
      createdAt: "2026-10-01T00:00:00Z",
    });
  });

  it("creates a new note in the class", async () => {
    vi.mocked(lessonNotesApi.createClassLessonNote).mockResolvedValue(DRAFT);
    vi.mocked(lessonNotesApi.getClassLessonNote).mockResolvedValue(DRAFT);
    renderAt("/creator/lesson-notes/c1/new");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Topic"), "Fractions");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(lessonNotesApi.createClassLessonNote).toHaveBeenCalledWith(
        "c1",
        expect.objectContaining({ topic: "Fractions", sessionDate: null }),
      ),
    );
  });

  it("publishes a draft and hides AI generation when the plan has no AI add-on", async () => {
    vi.mocked(lessonNotesApi.getClassLessonNote).mockResolvedValue(DRAFT);
    vi.mocked(lessonNotesApi.publishClassLessonNote).mockResolvedValue({
      ...DRAFT,
      status: "PUBLISHED",
      publishedAt: "2026-10-05T09:00:00Z",
      actions: { canEdit: true, canPublish: false, canUnpublish: true, canDelete: true },
    });
    renderAt("/creator/lesson-notes/c1/n1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Publish" }));

    await waitFor(() => expect(lessonNotesApi.publishClassLessonNote).toHaveBeenCalledWith("c1", "n1"));
    expect(await screen.findByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Generate with AI/ })).not.toBeInTheDocument();
  });

  it("offers AI generation when the plan includes it", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({ ...PLAN, aiLessonNotes: true });
    vi.mocked(lessonNotesApi.getClassLessonNote).mockResolvedValue(DRAFT);
    renderAt("/creator/lesson-notes/c1/n1");

    expect(await screen.findByRole("button", { name: /Generate with AI/ })).toBeInTheDocument();
  });
});
