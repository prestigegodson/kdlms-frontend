import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classQuizzesApi from "@/api/classTakeHomeQuizzes";
import * as creatorPlanApi from "@/api/creatorPlan";
import type { CreatorPlanView } from "@/api/creatorPlan";
import * as virtualClassesApi from "@/api/virtualClasses";
import { resetCreatorPlanStore } from "@/stores/creatorPlanStore";
import { CreatorQuizzesPage } from "./CreatorQuizzesPage";

vi.mock("@/api/creatorPlan");
vi.mock("@/api/classTakeHomeQuizzes");
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
  lessonNotes: false,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  takeHomeQuiz: true,
  onDemandLearning: false,
  learningMedia: false,
  communication: false,
  guardianAccess: false,
  autoRenew: false,
  graceUntil: null,
} satisfies CreatorPlanView;

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/creator/quizzes", element: <CreatorQuizzesPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("CreatorQuizzesPage", () => {
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
    vi.mocked(classQuizzesApi.listClassQuizzes).mockResolvedValue({
      classId: "c1",
      className: "Maths",
      writable: true,
      quizzes: [
        {
          id: "q1",
          title: "Fractions check",
          status: "PUBLISHED",
          availability: "OPEN",
          questionCount: 3,
          totalPoints: 6,
          opensAt: "2026-10-04T09:00:00Z",
          closesAt: "2026-10-11T09:00:00Z",
          updatedAt: "2026-10-04T09:00:00Z",
        },
      ],
    });
  });

  it("lists the first class's quizzes with their availability and offers a new quiz", async () => {
    renderAt("/creator/quizzes");

    expect(await screen.findByText("Fractions check")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New quiz/ })).toBeInTheDocument();
    expect(classQuizzesApi.listClassQuizzes).toHaveBeenCalledWith("c1");
  });

  it("hides New quiz for a read-only class", async () => {
    vi.mocked(classQuizzesApi.listClassQuizzes).mockResolvedValue({
      classId: "c1",
      className: "Maths",
      writable: false,
      quizzes: [],
    });
    renderAt("/creator/quizzes?classId=c1");

    expect(await screen.findByText(/so its quizzes are read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New quiz/ })).not.toBeInTheDocument();
  });

  it("shows an upgrade notice when the plan has no quizzes", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({ ...PLAN, takeHomeQuiz: false });
    renderAt("/creator/quizzes");

    expect(await screen.findByText("Quizzes aren't in your plan")).toBeInTheDocument();
    expect(virtualClassesApi.listVirtualClasses).not.toHaveBeenCalled();
  });
});
