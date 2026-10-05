import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classResourcesApi from "@/api/classLearningResources";
import * as creatorPlanApi from "@/api/creatorPlan";
import type { CreatorPlanView } from "@/api/creatorPlan";
import type { LearningResourceSummaryView } from "@/api/learning";
import * as virtualClassesApi from "@/api/virtualClasses";
import { resetCreatorPlanStore } from "@/stores/creatorPlanStore";
import { CreatorResourcesPage } from "./CreatorResourcesPage";

vi.mock("@/api/creatorPlan");
vi.mock("@/api/classLearningResources");
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
  takeHomeQuiz: false,
  onDemandLearning: true,
  learningMedia: false,
  communication: false,
  guardianAccess: false,
  autoRenew: false,
  graceUntil: null,
} satisfies CreatorPlanView;

function resource(overrides: Partial<LearningResourceSummaryView>): LearningResourceSummaryView {
  return {
    id: "r1",
    title: "Reading notes",
    subjectName: "",
    resourceType: "RICH_TEXT",
    status: "DRAFT",
    position: 0,
    availableFrom: null,
    availableUntil: null,
    updatedAt: "2026-10-04T09:00:00Z",
    ...overrides,
  };
}

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/creator/resources", element: <CreatorResourcesPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("CreatorResourcesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCreatorPlanStore();
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue(PLAN);
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue({
      classes: [
        {
          id: "c1",
          name: "English",
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
    vi.mocked(classResourcesApi.listClassResources).mockResolvedValue({
      classId: "c1",
      className: "English",
      writable: true,
      mediaIncluded: false,
      resources: [resource({}), resource({ id: "r2", title: "Phonics", resourceType: "YOUTUBE", status: "PUBLISHED" })],
    });
    vi.mocked(classResourcesApi.publishClassResource).mockResolvedValue(
      {} as Awaited<ReturnType<typeof classResourcesApi.publishClassResource>>,
    );
  });

  it("lists the first class's resources in order and offers Add resource", async () => {
    renderAt("/creator/resources");

    expect(await screen.findByText("Reading notes")).toBeInTheDocument();
    expect(screen.getByText("Phonics")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add resource" })).toBeInTheDocument();
    expect(classResourcesApi.listClassResources).toHaveBeenCalledWith("c1");
  });

  it("publishes a draft from its action menu", async () => {
    const user = userEvent.setup();
    renderAt("/creator/resources?classId=c1");

    await user.click(await screen.findByRole("button", { name: "Actions for Reading notes" }));
    await user.click(await screen.findByRole("menuitem", { name: /Publish/ }));

    expect(classResourcesApi.publishClassResource).toHaveBeenCalledWith("c1", "r1");
  });

  it("hides authoring for a read-only class", async () => {
    vi.mocked(classResourcesApi.listClassResources).mockResolvedValue({
      classId: "c1",
      className: "English",
      writable: false,
      mediaIncluded: false,
      resources: [],
    });
    renderAt("/creator/resources?classId=c1");

    expect(await screen.findByText(/so its resources are read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add resource" })).not.toBeInTheDocument();
  });

  it("shows an upgrade notice when the plan has no on-demand learning", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({ ...PLAN, onDemandLearning: false });
    renderAt("/creator/resources");

    expect(await screen.findByText("Resources aren't in your plan")).toBeInTheDocument();
    expect(virtualClassesApi.listVirtualClasses).not.toHaveBeenCalled();
  });
});
