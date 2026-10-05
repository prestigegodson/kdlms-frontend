import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorPlanApi from "@/api/creatorPlan";
import type { CreatorPlanView } from "@/api/creatorPlan";
import * as lessonNotesApi from "@/api/lessonNotes";
import * as virtualClassesApi from "@/api/virtualClasses";
import { resetCreatorPlanStore } from "@/stores/creatorPlanStore";
import { CreatorLessonNotesPage } from "./CreatorLessonNotesPage";

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

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/creator/lesson-notes", element: <CreatorLessonNotesPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("CreatorLessonNotesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreatorPlanStore();
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue(PLAN);
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue({
      classes: [
        {
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
        },
      ],
      maxClasses: 5,
      activeCount: 1,
      timezone: "Africa/Lagos",
    });
    vi.mocked(lessonNotesApi.listClassLessonNotes).mockResolvedValue({
      classId: "c1",
      className: "Maths",
      writable: true,
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
  });

  it("lists the first class's notes with their status and offers a new note", async () => {
    renderAt("/creator/lesson-notes");

    expect(await screen.findByText("Fractions")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New note/ })).toBeInTheDocument();
    expect(lessonNotesApi.listClassLessonNotes).toHaveBeenCalledWith("c1");
  });

  it("shows an upgrade notice when the plan has no lesson notes", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({ ...PLAN, lessonNotes: false });
    renderAt("/creator/lesson-notes");

    expect(await screen.findByText("Lesson notes aren't in your plan")).toBeInTheDocument();
    expect(virtualClassesApi.listVirtualClasses).not.toHaveBeenCalled();
  });
});
