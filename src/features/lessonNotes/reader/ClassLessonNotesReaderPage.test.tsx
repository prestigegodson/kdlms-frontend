import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as lessonNotesApi from "@/api/lessonNotes";
import type { ClassLessonNoteView } from "@/api/lessonNotes";
import * as onlineClassesApi from "@/api/onlineClasses";
import type { OnlineClass } from "@/api/onlineClasses";
import { EMPTY_CONTENT } from "@/features/lessonNotes/lessonNoteFormState";
import { ClassLessonNotesReaderPage } from "./ClassLessonNotesReaderPage";

vi.mock("@/api/lessonNotes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/lessonNotes")>()),
  listPublishedClassLessonNotes: vi.fn(),
  getPublishedClassLessonNote: vi.fn(),
  downloadClassLessonNoteImage: vi.fn(),
}));
vi.mock("@/api/onlineClasses");

const MATHS: OnlineClass = {
  id: "c1",
  name: "Maths",
  description: null,
  subjectLabel: null,
  creatorName: "Ada's Studio",
  timezone: "Africa/Lagos",
  startDate: "2026-10-01",
  endDate: null,
  slots: [],
  upcoming: [],
  remindersEnabled: true,
  creatorId: "t1",
  creatorLogoVersion: null,
  creatorBannerVersion: null,
};

const SCIENCE: OnlineClass = { ...MATHS, id: "c2", name: "Science" };

function summary(id: string, topic: string, sessionDate: string | null) {
  return {
    id,
    sessionDate,
    topic,
    status: "PUBLISHED" as const,
    aiGenerated: false,
    updatedAt: "2026-10-04T09:00:00Z",
    publishedAt: "2026-10-04T09:00:00Z",
  };
}

const NOTE: ClassLessonNoteView = {
  id: "n1",
  classId: "c1",
  className: "Maths",
  sessionDate: "2026-10-12",
  topic: "Fractions",
  content: { ...EMPTY_CONTENT, mode: "STRUCTURED", conclusion: "Halves and quarters" },
  status: "PUBLISHED",
  aiGenerated: false,
  updatedAt: "2026-10-04T09:00:00Z",
  publishedAt: "2026-10-04T09:00:00Z",
  actions: { canEdit: false, canPublish: false, canUnpublish: false, canDelete: false },
};

function renderAt(path: string, audience: "LEARNER" | "GUARDIAN") {
  const router = createMemoryRouter([{ path: "/notes", element: <ClassLessonNotesReaderPage audience={audience} /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("ClassLessonNotesReaderPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([MATHS]);
    vi.mocked(onlineClassesApi.listWardOnlineClasses).mockResolvedValue([
      { learnerId: "l1", firstName: "Kemi", lastName: "Ola", classes: [MATHS] },
    ]);
    vi.mocked(lessonNotesApi.listPublishedClassLessonNotes).mockResolvedValue({
      classId: "c1",
      className: "Maths",
      writable: false,
      notes: [
        {
          id: "n1",
          sessionDate: "2026-10-12",
          topic: "Fractions",
          status: "PUBLISHED",
          aiGenerated: false,
          updatedAt: "2026-10-04T09:00:00Z",
          publishedAt: "2026-10-04T09:00:00Z",
        },
      ],
    });
    vi.mocked(lessonNotesApi.getPublishedClassLessonNote).mockResolvedValue(NOTE);
  });

  it("lets a learner pick a published note and read it", async () => {
    renderAt("/notes", "LEARNER");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Fractions/ }));

    expect(await screen.findByText("Halves and quarters")).toBeInTheDocument();
    expect(lessonNotesApi.listPublishedClassLessonNotes).toHaveBeenCalledWith({ classId: "c1", learnerId: undefined });
    expect(lessonNotesApi.getPublishedClassLessonNote).toHaveBeenCalledWith(
      { classId: "c1", learnerId: undefined },
      "n1",
    );
  });

  it("reads on a guardian's behalf through the followed learner", async () => {
    renderAt("/notes", "GUARDIAN");

    expect(await screen.findByRole("option", { name: "Kemi - Maths" })).toBeInTheDocument();
    await waitFor(() =>
      expect(lessonNotesApi.listPublishedClassLessonNotes).toHaveBeenCalledWith({ classId: "c1", learnerId: "l1" }),
    );
  });

  it("explains when the tutor's plan doesn't include lesson notes", async () => {
    vi.mocked(lessonNotesApi.listPublishedClassLessonNotes).mockRejectedValue(
      new ApiError(403, "Lesson notes are not included in the current plan."),
    );
    renderAt("/notes?classId=c1", "LEARNER");

    expect(await screen.findByText("Lesson notes are not included in the current plan.")).toBeInTheDocument();
  });

  it("lists every class's notes newest first under \"All classes\" and opens one through its own class", async () => {
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([MATHS, SCIENCE]);
    vi.mocked(lessonNotesApi.listPublishedClassLessonNotes).mockImplementation(async ({ classId }) =>
      classId === "c1"
        ? { classId: "c1", className: "Maths", writable: false, notes: [summary("n1", "Fractions", "2026-10-12")] }
        : {
            classId: "c2",
            className: "Science",
            writable: false,
            notes: [summary("n2", "Plants", "2026-10-20"), summary("n3", "Safety rules", null)],
          },
    );
    vi.mocked(lessonNotesApi.getPublishedClassLessonNote).mockResolvedValue({
      ...NOTE,
      id: "n2",
      classId: "c2",
      className: "Science",
      topic: "Plants",
    });
    renderAt("/notes", "LEARNER");
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /Fractions/ });
    const topics = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(topics).toEqual([
      expect.stringContaining("Plants"),
      expect.stringContaining("Fractions"),
      expect.stringContaining("Safety rules"),
    ]);
    expect(screen.getByRole("combobox", { name: "Class" })).toHaveValue("");

    await user.click(screen.getByRole("button", { name: /Plants/ }));

    expect(await screen.findByText("Halves and quarters")).toBeInTheDocument();
    expect(lessonNotesApi.getPublishedClassLessonNote).toHaveBeenCalledWith({ classId: "c2", learnerId: undefined }, "n2");
  });
});
